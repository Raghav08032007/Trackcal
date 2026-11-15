// English singular forms for texts that change with a count. English is the key, so it has no catalog; without these,
// t("{count} meals logged today", { count: 1 }) would read "1 meals logged today". Used when the chosen language has no
// entry for the text (English, or a language still being translated). Keys match the English text in t() exactly.
export const EN_PLURALS: Record<string, { one: string; other: string }> = {
  "Copied {count} meals to today · +{xp} participation XP.": { one: "Copied {count} meal to today · +{xp} participation XP.", other: "Copied {count} meals to today · +{xp} participation XP." },
  "Copied {count} meals to your diary. Copying again won’t duplicate them; your device journal is unchanged.": { one: "Copied {count} meal to your diary. Copying again won’t duplicate it; your device journal is unchanged.", other: "Copied {count} meals to your diary. Copying again won’t duplicate them; your device journal is unchanged." },
  "Copy {count} meals to today": { one: "Copy {count} meal to today", other: "Copy {count} meals to today" },
  "Copy {count} meals to today? You can edit or delete them afterwards.": { one: "Copy this meal to today? You can edit or delete it afterwards.", other: "Copy these {count} meals to today? You can edit or delete them afterwards." },
  "Copy {count} selected meals": { one: "Copy {count} selected meal", other: "Copy {count} selected meals" },
  "Current Recipe Studio draft: {draftName}. Saved library: {count} recipes.": { one: "Current Recipe Studio draft: {draftName}. Saved library: {count} recipe.", other: "Current Recipe Studio draft: {draftName}. Saved library: {count} recipes." },
  "Imported {count} ingredients. Confirm grams, servings and nutrition before saving.": { one: "Imported {count} ingredient. Confirm grams, servings and nutrition before saving.", other: "Imported {count} ingredients. Confirm grams, servings and nutrition before saving." },
  "Imported {count} ingredients. Source yield: {yield}. Confirm grams, servings and nutrition before saving.": { one: "Imported {count} ingredient. Source yield: {yield}. Confirm grams, servings and nutrition before saving.", other: "Imported {count} ingredients. Source yield: {yield}. Confirm grams, servings and nutrition before saving." },
  "{count} days in a row. Rest is part of training, so take today easy.": { one: "{count} day in a row. Rest is part of training, so take today easy.", other: "{count} days in a row. Rest is part of training, so take today easy." },
  "{count} entries need nutrient review": { one: "{count} entry needs nutrient review", other: "{count} entries need nutrient review" },
  "{count} hours": { one: "{count} hour", other: "{count} hours" },
  "{count} meals": { one: "{count} meal", other: "{count} meals" },
  "{count} meals from the last {days} days are in this device’s journal. Review them before copying anything to your account diary.": { one: "{count} meal from the last {days} days is in this device’s journal. Review it before copying anything to your account diary.", other: "{count} meals from the last {days} days are in this device’s journal. Review them before copying anything to your account diary." },
  "{count} meals logged": { one: "{count} meal logged", other: "{count} meals logged" },
  "{count} meals logged for {date}": { one: "{count} meal logged for {date}", other: "{count} meals logged for {date}" },
  "{count} meals logged today": { one: "{count} meal logged today", other: "{count} meals logged today" },
  "{count} of your recipes can be used (priced in {currency}, {diet} diet). For a vegetarian or other diet, tag the recipe with it; change your diet in About you. Each meal is one serving. Tags are your own and don't guarantee a food is free of allergens.": { one: "{count} of your recipes can be used (priced in {currency}, {diet} diet). For a vegetarian or other diet, tag the recipe with it; change your diet in About you. Each meal is one serving. Tags are your own and don't guarantee a food is free of allergens.", other: "{count} of your recipes can be used (priced in {currency}, {diet} diet). For a vegetarian or other diet, tag the recipe with it; change your diet in About you. Each meal is one serving. Tags are your own and don't guarantee a food is free of allergens." },
};
