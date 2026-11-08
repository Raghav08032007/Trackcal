"""Blood reports: read values from a PDF or text (nothing stored), save the values the person confirms, and the plan they lead to."""
import base64
import binascii
from datetime import date, timedelta
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException
from routers.auth import get_current_active_user
from services import health_plan, lab_parse
from services.abuse_limits import consume
from services.lab_reference import BY_CODE, TESTS
from services.personalization_inputs import Preferences

MAX_PDF_BYTES = 8_000_000


class ReadInput(BaseModel):
    kind: Literal['pdf', 'text']
    data: str = Field(min_length=1, max_length=12_000_000)  # base64 for a PDF, the report text otherwise


class ResultInput(BaseModel):
    code: str
    value: float = Field(allow_inf_nan=False)
    ref_low: Optional[float] = Field(default=None, allow_inf_nan=False)
    ref_high: Optional[float] = Field(default=None, allow_inf_nan=False)

    @field_validator('code')
    @classmethod
    def known(cls, v):
        if v not in BY_CODE:
            raise ValueError('Unknown test.')
        return v


class ReportInput(BaseModel):
    report_date: date
    lab_name: Optional[str] = Field(default=None, max_length=80)
    source: Literal['pdf', 'photo', 'manual']
    results: list[ResultInput] = Field(min_length=1, max_length=len(TESTS))

    @field_validator('report_date')
    @classmethod
    def recent(cls, v):
        today = date.today()
        if not today - timedelta(days=3 * 365) <= v <= today + timedelta(days=1):
            raise ValueError('Use the date the sample was taken, within the last 3 years.')
        return v

    @field_validator('results')
    @classmethod
    def checked(cls, rows):
        if len({r.code for r in rows}) != len(rows):
            raise ValueError('Each test once per report.')
        for r in rows:
            low, high = BY_CODE[r.code].plausible
            if not low <= r.value <= high:
                raise ValueError(f'{BY_CODE[r.code].name} {r.value} looks like a misread. Check the value and unit.')
        return rows


def catalogue():
    """The tests we understand, for the manual entry form."""
    return {'tests': [{'code': t.code, 'name': t.name, 'unit': t.unit} for t in TESTS]}


def read(data: ReadInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Values found in a report. Nothing is stored here: the person checks them first."""
    consume(db, 'health-read', str(user.id), 30, 3600)
    if data.kind == 'pdf':
        try:
            raw = base64.b64decode(data.data, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=422, detail='That file could not be read as a PDF.')
        if len(raw) > MAX_PDF_BYTES or not raw.startswith(b'%PDF'):
            raise HTTPException(status_code=422, detail='Upload a PDF report under 8 MB.')
        try:
            text = lab_parse.pdf_text(raw)
        except ValueError as failure:
            raise HTTPException(status_code=422, detail=str(failure))
        except Exception:
            raise HTTPException(status_code=422, detail='That PDF could not be opened. Try saving it again or take a photo instead.')
    else:
        text = data.data[:200_000]
    readings = lab_parse.parse_text(text)
    note = '' if readings else ('This PDF looks like a scan with no text inside. Take a photo of the report instead, or type the values.' if data.kind == 'pdf' and len(text.strip()) < 40
                                else 'No known tests were found. You can type the values instead.')
    return {'readings': readings, 'note': note}


def prefs_of(db, user):
    row = db.get(models.PersonalizationProfile, user.id)
    try:
        return Preferences.model_validate(row.preferences) if row else Preferences()
    except Exception:
        return Preferences()


def assessment(db, user, report):
    prefs = prefs_of(db, user)
    rows = db.query(models.LabResult).filter_by(report_id=report.id).all()
    out = health_plan.assess([{'code': r.code, 'value': r.value, 'ref_low': r.ref_low, 'ref_high': r.ref_high} for r in rows],
                             sex=prefs.sex, age_group='under18' if user.is_minor else prefs.age_group, diet=prefs.diet)
    if out.get('plan'):
        out['plan']['retest_on'] = str(date.fromisoformat(report.report_date) + timedelta(days=out['plan']['retest_days']))
    return out


def report_view(report, count=None):
    return {'id': report.id, 'report_date': report.report_date, 'lab_name': report.lab_name, 'source': report.source, **({'tests': count} if count is not None else {})}


def save(data: ReportInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    consume(db, 'health-save', str(user.id), 30, 3600)
    report = models.LabReport(user_id=user.id, report_date=str(data.report_date), lab_name=(data.lab_name or '').strip() or None, source=data.source)
    db.add(report)
    db.flush()
    for r in data.results:
        db.add(models.LabResult(report_id=report.id, user_id=user.id, code=r.code, value=r.value, ref_low=r.ref_low, ref_high=r.ref_high))
    db.commit()
    return {'report': report_view(report, len(data.results)), **assessment(db, user, report)}


def summary(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """The latest report explained, its plan, and each test's history for the trend charts."""
    reports = db.query(models.LabReport).filter_by(user_id=user.id).order_by(models.LabReport.report_date.desc(), models.LabReport.created_at.desc()).all()
    if not reports:
        return {'reports': [], 'latest': None, 'history': {}}
    dates = {r.id: r.report_date for r in reports}
    history = {}
    for row in db.query(models.LabResult).filter(models.LabResult.user_id == user.id).all():
        if row.report_id in dates:
            history.setdefault(row.code, []).append({'date': dates[row.report_id], 'value': row.value})
    for points in history.values():
        points.sort(key=lambda p: p['date'])
    counts = {r.id: 0 for r in reports}
    for row in db.query(models.LabResult.report_id).filter(models.LabResult.user_id == user.id).all():
        counts[row[0]] = counts.get(row[0], 0) + 1
    latest = reports[0]
    return {'reports': [report_view(r, counts.get(r.id, 0)) for r in reports], 'latest': {'report': report_view(latest), **assessment(db, user, latest)}, 'history': history}


def delete(report_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    report = db.get(models.LabReport, report_id)
    if not report or report.user_id != user.id:
        raise HTTPException(status_code=404, detail='Report not found.')
    db.delete(report)
    db.commit()
