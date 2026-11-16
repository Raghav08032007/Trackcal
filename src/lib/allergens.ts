import { msg, localizedMap } from "./i18n";
/* Allergen matching follows fud-ai by apoorvdarshan (MIT licence): https://github.com/apoorvdarshan/fud-ai
 * Your listed allergies are checked against what a label declares first, then traces, then ingredients, then the
 * food's name, and the strongest match wins. Words for Indian foods are added so paneer counts as milk and maida as wheat. */
export type AllergenLevel='declared'|'may'|'possible';
export type AllergenSource={level:AllergenLevel;texts:string[]};
const GROUPS:Record<string,string[]>={
 milk:['milk','dairy','lactose','paneer','curd','dahi','yogurt','yoghurt','ghee','butter','cheese','cream','khoa','khova','malai','lassi','raita','kheer','whey','casein'],
 peanut:['peanut','groundnut','moongphali'],
 'tree nut':['cashew','kaju','almond','badam','walnut','akhrot','pistachio','pista','hazelnut','pecan','macadamia'],
 gluten:['gluten','wheat','atta','maida','roti','chapati','naan','paratha','bread','pasta','semolina','sooji','suji','rava','barley','rye','seitan'],
 egg:['egg','omelette','anda'],
 soy:['soy','soya','tofu','edamame'],
 fish:['fish','tuna','salmon','pomfret','surmai','rohu','anchovy'],
 shellfish:['shellfish','prawn','shrimp','crab','lobster','jhinga'],
 sesame:['sesame','til','tahini','gingelly'],
 mustard:['mustard','sarson','rai'],
};
const ORDER:AllergenLevel[]=['declared','may','possible'];
/** Turns "nuts, lactose" into the groups to look for. "Nuts" covers peanuts and tree nuts. */
export function allergyGroups(allergies:string[]){
 const out=new Set<string>();
 for(const raw of allergies){
  const word=raw.toLowerCase().trim();if(!word)continue;
  if(/\bnuts?\b/.test(word)){out.add('peanut');out.add('tree nut');}
  for(const [group,words] of Object.entries(GROUPS))if(word.includes(group)||words.some(w=>word.includes(w)))out.add(group);
 }
 return [...out];
}
const mentions=(text:string,group:string)=>{const t=` ${text.toLowerCase().replace(/[^a-z ]/g,' ')} `;return [group,...GROUPS[group]].some(w=>new RegExp(`[ ]${w}(s|es)?[ ]`).test(t));};
export function checkAllergens(sources:AllergenSource[],allergies:string[]){
 const groups=allergyGroups(allergies);
 if(!groups.length)return null;
 for(const level of ORDER){
  const matched=groups.filter(group=>sources.some(source=>source.level===level&&source.texts.some(text=>mentions(text,group))));
  if(matched.length)return {level,matched};
 }
 return {level:'none' as const,matched:[] as string[]};
}
export const ALLERGEN_WORDS:Record<AllergenLevel,string>={declared:msg("Contains"),may:msg("May contain"),possible:msg("Might contain")};
localizedMap(ALLERGEN_WORDS);
