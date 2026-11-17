import { t } from "@/lib/i18n";
import type { ProductDetails } from "@/lib/api";

/** What the pack says: where the code comes from, its certifications, additives and printed terms. */
export function ProductFacts({ facts }: { facts: ProductDetails }) {
  const { registered_in, made_in, sold_in = [], certifications = [], additives = [], codes = [], terms = [], ingredients, allergens = [] } = facts;
  const empty = !registered_in && !made_in && !sold_in.length && !certifications.length && !additives.length && !codes.length && !terms.length && !ingredients && !allergens.length;
  if (empty) return null;
  return <section className="product-facts" aria-label={t("Product details")}>
    <h4>{t("What the pack tells you")}</h4>
    {registered_in && <p><strong>{t("Barcode issued in {registered_in}.", { registered_in })}</strong> {t("This is where the company registered the code, which may not be where the food was made.")}</p>}
    {made_in && <p><strong>{t("Made in or from:")}</strong> {made_in}</p>}
    {!!sold_in.length && <p><strong>{t("Sold in:")}</strong> {sold_in.join(", ")}</p>}
    {!!certifications.length && <><h5>{t("Certifications and claims")}</h5><ul>{certifications.map(mark => <li key={mark.name}><strong>{mark.name}</strong>{mark.region ? ` · ${mark.region}` : ""}{mark.meaning ? `. ${mark.meaning}` : ""}</li>)}</ul></>}
    {!!codes.length && <><h5>{t("Codes on the pack")}</h5><ul>{codes.map(row => <li key={row.kind + row.value}><strong>{row.kind}:</strong> {row.value}</li>)}</ul></>}
    {!!additives.length && <><h5>{t("Additives")}</h5><ul>{additives.map(row => <li key={row.code}><strong>{row.code}</strong>{row.name ? ` · ${row.name}` : ""}</li>)}</ul></>}
    {!!terms.length && <><h5>{t("Terms explained")}</h5><ul>{terms.map(row => <li key={row.term}><strong>{row.term}:</strong> {row.meaning}</li>)}</ul></>}
    {ingredients && <details><summary>{t("Ingredients")}</summary><p>{ingredients}</p></details>}
    {!!allergens.length && <p><strong>{t("Allergens listed:")}</strong> {allergens.join(", ")}</p>}
    <small>{t("From community data or the pack photo, not checked with the certifier. Trust the label, especially for allergies.")}</small>
  </section>;
}
