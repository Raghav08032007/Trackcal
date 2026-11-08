"""Reading values from lab report text in the layouts Indian labs print, and from a real PDF."""
import pytest

from services import lab_parse

TABULAR = """
PATIENT NAME : XXXXX            AGE/SEX : 34 Y / F
Sample Type : Fasting Blood     Collected : 02/11/2026
TEST NAME                         RESULT     UNIT      BIOLOGICAL REF. INTERVAL
GLYCOSYLATED HAEMOGLOBIN (HbA1c)  6.2        %         4.0 - 5.6
Estimated Average Glucose (eAG)   131        mg/dL
GLUCOSE, FASTING (F)              112        mg/dL     70 - 100
LIPID PROFILE
CHOLESTEROL, TOTAL                228        mg/dL     < 200
TRIGLYCERIDES                     190        mg/dL     < 150
HDL CHOLESTEROL                   38         mg/dL     > 40
LDL CHOLESTEROL, DIRECT           158        mg/dL     < 100
VLDL                              38         mg/dL     < 30
LDL / HDL RATIO                   4.2               < 3.5
HAEMOGLOBIN                       10.8       g/dL      12.0 - 15.5
VITAMIN D, 25-HYDROXY             14.6       ng/mL     30 - 100
VITAMIN B12                       182        pg/mL     211 - 911
THYROID STIMULATING HORMONE (TSH) 5.82       µIU/mL    0.27 - 4.20
"""

COLON = """
Hemoglobin : 13.9 g/dl (13.0 - 17.0)
S. Creatinine : 1.1 mg/dl (0.7-1.3)
Uric Acid : 7.9 mg/dl (3.4 - 7.0)
SGPT (ALT) : 64 U/L (Upto 45)
SGOT (AST) : 41 U/L (Upto 40)
Ferritin : 22 ng/ml (30 - 400)
"""

SI_AND_SPLIT = """
Fasting Plasma Glucose
6.1 mmol/L 3.9 - 5.5
Total Cholesterol 5.9 mmol/L
Vitamin D (25-OH) 50 nmol/L 75 - 250
Potassium 4.2 mmol/L 3.5 - 5.1
"""

INTERPRETATION = """
LDL CHOLESTEROL  142 mg/dL
Interpretation:
Optimal < 100
Near optimal 100 - 129
HbA1c  5.4 %
Below 5.7 Normal
5.7 - 6.4 Prediabetes
"""


def by_code(text):
    return {r['code']: r for r in lab_parse.parse_text(text)}


def test_tabular_report():
    r = by_code(TABULAR)
    assert r['hba1c']['value'] == 6.2 and (r['hba1c']['ref_low'], r['hba1c']['ref_high']) == (4.0, 5.6)
    assert r['glucose_fasting']['value'] == 112 and r['glucose_fasting']['ref_high'] == 100
    assert r['cholesterol']['value'] == 228 and r['cholesterol']['ref_high'] == 200
    assert r['triglycerides']['value'] == 190
    assert r['hdl']['value'] == 38 and r['hdl']['ref_low'] == 40
    assert r['ldl']['value'] == 158 and r['ldl']['ref_high'] == 100       # not the VLDL or the ratio
    assert r['hemoglobin']['value'] == 10.8 and (r['hemoglobin']['ref_low'], r['hemoglobin']['ref_high']) == (12.0, 15.5)
    assert r['vitamin_d']['value'] == 14.6                                 # not the 25 in "25-HYDROXY"
    assert r['vitamin_b12']['value'] == 182 and r['vitamin_b12']['ref_low'] == 211
    assert r['tsh']['value'] == 5.82 and r['tsh']['ref_high'] == 4.2
    assert 'glucose_pp' not in r                                          # "Estimated Average Glucose" is not a glucose test


def test_colon_and_upto_layout():
    r = by_code(COLON)
    assert r['hemoglobin']['value'] == 13.9 and r['creatinine']['value'] == 1.1
    assert r['uric_acid']['value'] == 7.9 and r['uric_acid']['ref_high'] == 7.0
    assert r['alt']['value'] == 64 and r['alt']['ref_high'] == 45
    assert r['ast']['value'] == 41 and r['ferritin']['value'] == 22


def test_si_units_are_converted_and_values_on_the_next_line_are_found():
    r = by_code(SI_AND_SPLIT)
    assert r['glucose_fasting']['value'] == pytest.approx(109.8) and r['glucose_fasting']['ref_high'] == pytest.approx(99)
    assert r['cholesterol']['value'] == pytest.approx(228.2, abs=0.2)
    assert r['vitamin_d']['value'] == 20 and r['vitamin_d']['ref_low'] == 30
    assert r['potassium']['value'] == 4.2


def test_interpretation_tables_do_not_replace_the_result():
    r = by_code(INTERPRETATION)
    assert r['ldl']['value'] == 142 and r['hba1c']['value'] == 5.4


def test_misreads_and_non_results_are_dropped():
    r = by_code('Sample type: Fasting\nHaemoglobin 145 g/dL\nHbA1c pending\nTSH 3.1 mIU/L')
    assert 'hemoglobin' not in r and 'hba1c' not in r and 'glucose_fasting' not in r
    assert r['tsh']['value'] == 3.1
    assert lab_parse.parse_text('') == []


def _pdf(lines):
    """A small real PDF with text, built by hand so the test needs no PDF writer."""
    content = 'BT /F1 10 Tf 40 800 Td 14 TL ' + ' '.join(f'({l.replace("(", "[").replace(")", "]")}) Tj T*' for l in lines) + ' ET'
    objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
               f'<< /Length {len(content)} >>\nstream\n{content}\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    out, offsets = '%PDF-1.4\n', []
    for n, body in enumerate(objects, 1):
        offsets.append(len(out.encode('latin-1')))
        out += f'{n} 0 obj\n{body}\nendobj\n'
    xref = len(out.encode('latin-1'))
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n' + ''.join(f'{o:010d} 00000 n \n' for o in offsets)
    out += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'
    return out.encode('latin-1')


def test_a_real_pdf_is_read():
    text = lab_parse.pdf_text(_pdf(['HbA1c 6.8 % 4.0 - 5.6', 'LDL Cholesterol 171 mg/dL < 100', 'Hemoglobin 11.2 g/dL 12.0 - 15.5']))
    r = by_code(text)
    assert r['hba1c']['value'] == 6.8 and r['ldl']['value'] == 171 and r['hemoglobin']['value'] == 11.2
