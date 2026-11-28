import { t, msg } from "@/lib/i18n";
import { useBurn } from "@/lib/days";

import { FoodCamera } from "@/components/food-camera";
import { useTarget } from "@/lib/targets";
import { useDiaryMeals } from "@/lib/diary";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { consistencyWarning, FIELDS as NUTRIENT_FIELDS, rounded, scale, type Nutrients } from "@/lib/nutrition-math";
import { useAccount } from "@/components/account-session";
import {confirmAdultForCalculator} from "@/lib/personalization";
import { MealIdeaTransfer } from "@/components/meal-idea-transfer";
import { VoiceInput } from "@/components/voice-input";
import {type AppTab} from "@/components/app-design";
import {useRouter, useSearch} from "@/lib/navigation";
import {foodRoutes,foodNames,foodIntros} from "@/lib/feature-guide";
import { BarcodeCamera } from "@/components/barcode-camera";
import { JournalTools, type MealLog } from "@/components/journal-tools";
import { FoodRow, type LibraryFood } from "@/components/food-row";
import { AddDish } from "@/components/add-dish";
import { AllergenAlert } from "@/components/allergen-alert";
import { addDish, dropDish, foodDish, plateTotals } from "@/lib/plate";
import { ProductFacts } from "@/components/product-facts";
import { useLocalDate, useLocalState } from "@/lib/use-local-state";
import { earnedBack } from "@/lib/workout-coach";
import { wellnessRequest } from "@/lib/wellness";
import {
  Camera,
  Flame,
  Dna,
  Wheat,
  Droplet,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Clock,
  Utensils,
  Barcode,
  BookOpen,
  Trash2,
  Upload,
  Loader2
} from "lucide-react";

import {
  lookupBarcodeNutrition,
  calculateOnboardingPlan,
  parseMealWithAI,
  analyzeMealPhoto,
  readPackPhoto,
  type ProductDetails
} from "../lib/api";

interface FoodItem {
  id: string;
  name: string;
  category: string;
  cuisine: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
  verified: boolean;
  allergens: string[];
}

const SAMPLE_DATABASE: FoodItem[] = [
  {
    id: "f1",
    name: "Chicken Biryani (Hyderabadi Style)",
    category: "Main Dish",
    cuisine: "Indian",
    serving_size: "350g (1 plate)",
    calories: 490,
    protein: 32,
    carbs: 58,
    fat: 14,
    fiber: 3.5,
    source: "Global Food AI Curated",
    verified: true,
    allergens: ["Dairy (Ghee)"]
  },
  {
    id: "f2",
    name: "Tonkotsu Ramen with Chashu & Ajitama",
    category: "Noodle Soup",
    cuisine: "Japanese",
    serving_size: "500ml bowl",
    calories: 580,
    protein: 29,
    carbs: 64,
    fat: 22,
    fiber: 4.0,
    source: "Open Food Facts",
    verified: true,
    allergens: ["Gluten", "Soy", "Egg"]
  },
  {
    id: "f3",
    name: "Mediterranean Greek Salad with Feta",
    category: "Salad",
    cuisine: "Mediterranean",
    serving_size: "250g bowl",
    calories: 220,
    protein: 7,
    carbs: 11,
    fat: 17,
    fiber: 4.2,
    source: "USDA FoodData Central",
    verified: true,
    allergens: ["Dairy"]
  },
  {
    id: "f4",
    name: "Avocado Sourdough Toast with Poached Egg",
    category: "Breakfast",
    cuisine: "American / Modern",
    serving_size: "180g (1 slice)",
    calories: 310,
    protein: 14,
    carbs: 26,
    fat: 18,
    fiber: 6.8,
    source: "USDA FoodData Central",
    verified: true,
    allergens: ["Gluten", "Egg"]
  },
  {
    id: "f5",
    name: "Paneer Butter Masala with 2 Rotis",
    category: "Curry & Bread",
    cuisine: "North Indian",
    serving_size: "380g combo",
    calories: 520,
    protein: 21,
    carbs: 49,
    fat: 26,
    fiber: 5.5,
    source: "Global Food AI Curated",
    verified: true,
    allergens: ["Dairy", "Gluten"]
  }
];

type PhotoRange = { grams: [number, number]; calories: [number, number]; confidence: "High" | "Medium" | "Low"; fromModel: boolean };
type ScanItem = (typeof SCAN_PRESETS)[number]["items"][number] & { count?: number | null; edible?: number | null; ingredients?: string };
type ScanView = Omit<(typeof SCAN_PRESETS)[number], "items"> & { items: ScanItem[] };
type ScanSource = "none" | "sample" | "photo";
const confidenceLabel = (value: number): PhotoRange["confidence"] => value >= 0.75 ? "High" : value >= 0.45 ? "Medium" : "Low";
const SCAN_PRESETS = [
  {
    label: "Chicken Biryani Plate",
    foodName: "Hyderabadi Chicken Biryani",
    weight: "360g",
    confidence: 96.4,
    calories: 510,
    protein: 34,
    carbs: 61,
    fat: 15,
    fiber: 3.8,
    nova: { group: 3, label: "Processed (Home-Crafted)", color: "text-amber-400" },
    items: [
      { name: "Basmati Spiced Rice", portion: "220g", cal: 280, p: 5, c: 54, f: 3 },
      { name: "Marinated Chicken Thigh", portion: "110g", cal: 180, p: 27, c: 2, f: 7 },
      { name: "Raita & Fried Onions", portion: "30g", cal: 50, p: 2, c: 5, f: 5 }
    ],
    allergens: ["Dairy (Ghee)"],
    method: "Demo meal — sample nutrition, not a live scan"
  },
  {
    label: "Avocado Egg Toast",
    foodName: "Sourdough Toast with Sliced Avocado & Egg",
    weight: "210g",
    confidence: 98.1,
    calories: 340,
    protein: 16,
    carbs: 28,
    fat: 19,
    fiber: 7.2,
    nova: { group: 1, label: msg("Unprocessed / Whole Food"), color: "text-emerald-400" },
    items: [
      { name: "Artisan Sourdough Slice", portion: "60g", cal: 140, p: 5, c: 26, f: 1 },
      { name: "Fresh Hass Avocado", portion: "90g", cal: 130, p: 2, c: 2, f: 12 },
      { name: "Soft Poached Egg", portion: "60g", cal: 70, p: 9, c: 0, f: 6 }
    ],
    allergens: ["Gluten", "Egg"],
    method: "Demo meal — sample nutrition, not a live scan"
  },
  {
    label: "Salmon Poké Bowl",
    foodName: "Atlantic Salmon Brown Rice Poké Bowl",
    weight: "390g",
    confidence: 94.7,
    calories: 475,
    protein: 31,
    carbs: 52,
    fat: 16,
    fiber: 6.0,
    nova: { group: 1, label: msg("Unprocessed / Whole Food"), color: "text-emerald-400" },
    items: [
      { name: "Raw Atlantic Salmon Cubes", portion: "120g", cal: 220, p: 24, c: 0, f: 13 },
      { name: "Steamed Brown Rice", portion: "150g", cal: 170, p: 4, c: 36, f: 1 },
      { name: "Edamame, Cucumber & Nori", portion: "120g", cal: 85, p: 3, c: 16, f: 2 }
    ],
    allergens: ["Fish", "Soy (Edamame)", "Sesame"],
    method: "Demo meal — sample nutrition, not a live scan"
  }
];

type BarcodeKey = "caloriesPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g";
type BarcodeView = { code: string; name: string; brand: string; serving: string; caloriesPer100g: number | null; proteinPer100g: number | null; carbsPer100g: number | null; fatPer100g: number | null; servingCalories?: number; novaGroup: number; novaLabel: string; allergens: string[]; attribution?: string };
const PACKAGED_BARCODE_PRODUCTS: BarcodeView[] = [
  {
    code: "3017620422003",
    name: "Nutella Hazelnut Cocoa Spread",
    brand: "Ferrero",
    serving: "15g (1 tbsp)",
    caloriesPer100g: 539,
    proteinPer100g: 6.3,
    carbsPer100g: 57.5,
    fatPer100g: 30.9,
    servingCalories: 81,
    novaGroup: 4,
    novaLabel: msg("Ultra-Processed Food (UPF)"),
    allergens: ["Milk", "Soybeans", "Hazelnuts"]
  },
  {
    code: "5449000000996",
    name: "Coca-Cola Original Taste",
    brand: "The Coca-Cola Company",
    serving: "330ml (1 can)",
    caloriesPer100g: 42,
    proteinPer100g: 0.0,
    carbsPer100g: 10.6,
    fatPer100g: 0.0,
    servingCalories: 139,
    novaGroup: 4,
    novaLabel: "Ultra-Processed Beverage",
    allergens: []
  },
  {
    code: "030000010204",
    name: "Quaker Rolled Old Fashioned Oats",
    brand: "Quaker",
    serving: "40g (1/2 cup)",
    caloriesPer100g: 375,
    proteinPer100g: 12.5,
    carbsPer100g: 67.5,
    fatPer100g: 6.5,
    servingCalories: 150,
    novaGroup: 1,
    novaLabel: "Minimally Processed Grain",
    allergens: ["Oats (Gluten)"]
  }
];

export function FoodWorkspace({initialTab="scanner"}:{initialTab?:AppTab}) {
  const { ready, user } = useAccount();
  if (!ready) return <main className="account-loading" aria-live="polite">{t("Opening your workspace…")}</main>;
  return <Workspace key={user?.id || "guest"} initialTab={initialTab} />;
}

function Workspace({initialTab}:{initialTab:AppTab}) {
  const router=useRouter();
  const {user}=useAccount();
  function navigateTab(tab: AppTab) {
    setActiveTab(tab);
    router.push(foodRoutes[tab]);
  }
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [selectedPreset, setSelectedPreset] = useState(-1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanView>(() => ({ ...SCAN_PRESETS[0], label: "", foodName: msg("Nothing scanned yet"), weight: "0g", confidence: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, items: [], allergens: [], method: msg("Snap or upload a meal to see its estimate.") } as ScanView));
  const [scanSource, setScanSource] = useState<ScanSource>("none");
  // The AI's own numbers for the last photo, before any review: saved beside the logged meal for the accuracy report.
  const [aiOriginal, setAiOriginal] = useState<{ calories: number; grams: number } | null>(null);
  const [portionGrams, setPortionGrams] = useState(0);
  const search = useSearch(), [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(search).get("q") ?? "");   // /food-library?q=dal opens with a search
  const [remoteFoods, setRemoteFoods] = useState<LibraryFood[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [foodSearchError, setFoodSearchError] = useState("");
  const foodSearchRequest = useRef(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [goalError, setGoalError] = useState("");
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("goals")!=="1")return;const timer=window.setTimeout(()=>setShowOnboarding(true),0);return()=>window.clearTimeout(timer);},[]);
  const goalDialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showOnboarding) return;
    const previous = document.activeElement as HTMLElement | null;
    goalDialog.current?.querySelector<HTMLElement>("button, input, select")?.focus();
    return () => { previous?.focus(); };
  }, [showOnboarding]);
  const [notice, setNotice] = useState("");
  const photoRequest = useRef(0);
  const barcodeRequest = useRef(0);

  // Goal & TDEE State
  const [onboardingForm, setOnboardingForm] = useState({
    sex: "male",
    age: 26,
    weight: 74,
    height: 178,
    activity: "moderate",
    goal: "lose_weight",
    diet: "standard"
  });

  const [dailyTarget, setDailyTarget] = useTarget("calories");
  const [targetProtein, setTargetProtein] = useTarget("protein");
  const [targetCarbs, setTargetCarbs] = useTarget("carbs");
  const [targetFat, setTargetFat] = useTarget("fat");

  // Backend Health Ping

  // Uploaded Image State
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl); }, [uploadedImageUrl]);

  const [scanError, setScanError] = useState("");
  const [scanReady, setScanReady] = useState(false);
  const [photoConsent,setPhotoConsent]=useState(false);
  const [photoNote,setPhotoNote]=useState("");
  const [photoRange,setPhotoRange]=useState<PhotoRange|null>(null);
  const [pendingPhoto,setPendingPhoto]=useState<File|null>(null);
  const [dishOptions,setDishOptions]=useState<string[]>([]),[dishFix,setDishFix]=useState(""),[photoOffline,setPhotoOffline]=useState(false);
  const [cameraOpen,setCameraOpen]=useState(false);
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; await processPhoto(file); e.target.value = ""; };
  const processPhoto = async (file?: File, namedDish?: string) => {
    if (file) {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024){setScanError(t("Use a nonempty JPEG, PNG or WebP under 10 MB."));setScanReady(false);return;}
      setPendingPhoto(file); setPhotoRange(null);
      const requestId = ++photoRequest.current;
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      const url = URL.createObjectURL(file);
      setUploadedImageUrl(url);
      if(!photoConsent){setIsScanning(false);setScanReady(false);setScanError(t("Photo stays on this device. Confirm AI consent or choose a food manually in the cloud diary."));return;}
      setIsScanning(true);
      setScanError(""); setScanReady(false);
      try {
        // A correction names the dish: the same photo is checked again with that name, so portion and nutrition fit the real dish.
        const result = await analyzeMealPhoto(file, namedDish ? `This dish is ${namedDish}. ${photoNote}`.trim() : photoNote);
        setDishOptions((result.alternatives ?? []).filter(a => a.toLowerCase() !== (namedDish ?? result.dish_name).toLowerCase()));setDishFix("");setPhotoOffline(result.offline === true);
        if (requestId !== photoRequest.current) return;
        const grams = Math.round(result.components.reduce((sum, item) => sum + item.quantity_g, 0));
        setAiOriginal(Number.isFinite(result.total_nutrition.calories) && grams > 0 ? { calories: Math.round(result.total_nutrition.calories), grams } : null);
        setScanResult({
          label: "Uploaded Meal",
          foodName: result.dish_name,
          weight: `${grams}g`,
          confidence: Math.round(result.components.reduce((sum, item) => sum + item.confidence, 0) / result.components.length * 100),
          calories: result.total_nutrition.calories,
          protein: result.total_nutrition.protein_g,
          carbs: result.total_nutrition.carbs_g,
          fat: result.total_nutrition.fat_g,
          fiber: 0,
          nova: { group: 0, label: "Not assessed", color: "text-slate-400" },
          items: result.components.map(item => ({ name: item.name, portion: `${item.quantity_g}g`, cal: item.calories, p: item.protein_g, c: item.carbs_g, f: item.fat_g, count: item.count, edible: item.edible_g, ingredients: item.ingredients?.map(row => row.name).join(", ") })),
          allergens: [],
          method: `AI estimate · ${result.model}. Review portions and nutrition before logging. Allergens not assessed.`
        });
        const mean = result.components.reduce((sum, item) => sum + item.confidence, 0) / result.components.length;
        if (result.calorie_range && result.components.every(item => item.portion_range_g)) setPhotoRange({ grams: [0, 1].map(i => Math.round(result.components.reduce((sum, item) => sum + item.portion_range_g[i], 0))) as [number, number],
          calories: [Math.round(result.calorie_range[0]), Math.round(result.calorie_range[1])], confidence: confidenceLabel(mean), fromModel: result.components.every(item => item.range_basis === "model") });
        setScanSource("photo"); setPortionGrams(grams); setCookingStyle("standard"); setScanReady(true); requestAnimationFrame(() => document.getElementById("scan-result-title")?.scrollIntoView({ block: "center" }));
      } catch (error) { if (requestId === photoRequest.current) setScanError(error instanceof Error ? error.message : t("Photo analysis failed.")); }
      finally { if (requestId === photoRequest.current) setIsScanning(false); }
    }
  };

  const calculateAndApplyOnboarding = async () => {
    setGoalError("");
    try {
    if(user)await confirmAdultForCalculator(onboardingForm.age);
    const { sex, age, weight, height, activity, goal, diet } = onboardingForm;
    const plan = await calculateOnboardingPlan({
      age,
      gender: sex as "male" | "female",
      weight_kg: weight,
      height_cm: height,
      activity_level: activity === "moderate" ? "moderately_active" : (activity === "light" ? "lightly_active" : (activity === "very_active" ? "very_active" : "sedentary")),
      primary_goal: (goal === "build_muscle" ? "gain_muscle" : goal) as "lose_weight" | "maintain" | "gain_muscle" | "recomposition",
      speed_kg_per_week: 0.5,
      dietary_preference: diet
    });

    setDailyTarget(plan.calorie_target);
    setTargetProtein(plan.macros.protein_g);
    setTargetCarbs(plan.macros.carbs_g);
    setTargetFat(plan.macros.fat_g);
    setShowOnboarding(false);
    setNotice(t("Your target is {calorie_target} kcal a day, with {protein_g} g protein. Track it in Journal.", { calorie_target: plan.calorie_target, protein_g: plan.macros.protein_g }));
    } catch (error) { setGoalError(error instanceof Error ? error.message : t("Unable to calculate goals.")); }
  };

  // Cooking Style & Hidden Oil Slider
  const [cookingStyle, setCookingStyle] = useState<"steamed_boiled" | "home_light" | "standard" | "restaurant_heavy" | "deep_fried">("standard");

  const COOKING_STYLES = {
    steamed_boiled: { label: msg("Steamed / Boiled"), calMult: 0.88, fatMult: 0.65, desc: msg("Zero added oil") },
    home_light: { label: msg("Home-Cooked Light"), calMult: 0.94, fatMult: 0.85, desc: msg("Minimal cooking oil") },
    standard: { label: msg("Standard Recipe"), calMult: 1.0, fatMult: 1.0, desc: msg("Balanced baseline") },
    restaurant_heavy: { label: msg("Restaurant (Ghee/Butter Heavy)"), calMult: 1.25, fatMult: 1.45, desc: msg("+40% hidden fats") },
    deep_fried: { label: msg("Deep Fried"), calMult: 1.48, fatMult: 1.85, desc: msg("High oil absorption") },
  };

  const handleSimulateScan = (presetIndex: number) => {
    photoRequest.current++;
    setScanError(""); setScanReady(true); setScanSource("sample");
    setIsScanning(false);
    setSelectedPreset(presetIndex);
    setUploadedImageUrl(null);
      setScanResult(SCAN_PRESETS[presetIndex]);
      const initialWeight = parseInt(SCAN_PRESETS[presetIndex].weight) || 300;
      setPortionGrams(initialWeight);
      setCookingStyle("standard");
      setIsScanning(false);
  };

  const scaleFactor = portionGrams / (parseInt(scanResult.weight) || 1);
  const styleMult = COOKING_STYLES[cookingStyle];
  const scaledCalories = Math.round(scanResult.calories * scaleFactor * styleMult.calMult);
  const scaledProtein = Math.round(scanResult.protein * scaleFactor);
  const scaledCarbs = Math.round(scanResult.carbs * scaleFactor);
  const scaledFat = Math.round(scanResult.fat * scaleFactor * styleMult.fatMult);

  /** Correct one food: its share of the meal rescales, and the total follows. */
  const editScanItem = (index: number, grams: number, count?: number) => {
    if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) return;
    const items = scanResult.items.map((item, i) => {
      const shown = parseFloat(item.portion) * scaleFactor, ratio = scaleFactor * (i === index ? grams / (shown || 1) : 1), edible = item.edible ? item.edible * ratio : item.edible;
      return { ...item, portion: `${Math.round(parseFloat(item.portion) * ratio)}g`, cal: item.cal * ratio, p: item.p * ratio, c: item.c * ratio, f: item.f * ratio, edible, count: i === index && count ? count : item.count };
    });
    setPlate(items);
  };
  /** The range no longer applies once the person has corrected the plate. */
  const setPlate = (items: ScanItem[]) => {
    const totals = plateTotals(items);
    setScanResult({ ...scanResult, items, ...totals });
    setPortionGrams(parseInt(totals.weight)); setPhotoRange(null);
  };

  async function readPack(file: File) {
    setReadingPack(true); setBarcodeError(null);
    try {
      const pack = await readPackPhoto(file);
      if (pack.barcode) { await handleSearchBarcode(pack.barcode); setProductFacts(facts => ({ ...pack.details, ...Object.fromEntries(Object.entries(facts ?? {}).filter(([, value]) => Array.isArray(value) ? value.length : value)) })); return; }
      setProductFacts(pack.details);
      barcodeRequest.current++; setBarcodeOverrides({}); setBarcodeInput(""); setBarcodeSource("Your pack photo, read by AI");
      setSelectedBarcodeProduct({ code: "No barcode", name: pack.product_name || "Product from your photo", brand: pack.brand || "Brand not read", serving: "Not stated", caloriesPer100g: pack.per_100g.calories, proteinPer100g: pack.per_100g.protein_g, carbsPer100g: pack.per_100g.carbs_g, fatPer100g: pack.per_100g.fat_g, attribution: "Read from your photo. Check it against the pack.", novaGroup: 0, novaLabel: msg("NOVA not assessed"), allergens: pack.details.allergens ?? [] });
      setBarcodeReady(true);
    } catch (error) { setBarcodeError(error instanceof Error ? error.message : t("Could not read that photo.")); }
    finally { setReadingPack(false); }
  }

  const today = useLocalDate();
  const [selectedDate, setJournalDate] = useState("");
  const journalDate = selectedDate || today;
  const [loggedMeals, setLoggedMeals] = useDiaryMeals(journalDate);
  const [deletedMeal, setDeletedMeal] = useState<{ meal: MealLog; index: number } | null>(null);

  const totalCaloriesLogged = loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const [workoutBurn] = useBurn(journalDate), workoutBack = earnedBack(workoutBurn), budgetLeft = Math.max(0, dailyTarget + workoutBack - totalCaloriesLogged);
  const calPercent = Math.min(100, Math.round((totalCaloriesLogged / ((dailyTarget + workoutBack) || 2000)) * 100));

  const addCurrentScanToLog = () => {
    if (!scanReady || isScanning) return;
    // The sample shown before any photo is scanned is not a meal: it never goes into the diary.
    if (!uploadedImageUrl) { setNotice(t("Scan a photo of your meal first. The example shown here is sample data and isn't logged.")); return; }
    setNotice(t("Meal added to your journal for {journalDate}.", { journalDate }));
    setLoggedMeals([
      ...loggedMeals,
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        name: `${scanResult.foodName} (${styleMult.label})`,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: scaledCarbs,
        fat: scaledFat,
        grams: portionGrams > 0 ? portionGrams : undefined,
        method: msg("Photo scan (user reviewed)"),
        ...(scanSource === "photo" && aiOriginal ? { ai_estimate: aiOriginal } : {})
      }
    ]);
  };

  // Barcode State & Open Food Facts Lookup
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<BarcodeView>(PACKAGED_BARCODE_PRODUCTS[0]);
  // Values the user typed from the packaging label for nutrients Open Food Facts does not list.
  const [barcodeOverrides, setBarcodeOverrides] = useState<Partial<Record<BarcodeKey, number>>>({});
  const [savingBarcode, setSavingBarcode] = useState(false);
  const barcodeValues: Nutrients = {
    energy_kcal: barcodeOverrides.caloriesPer100g ?? selectedBarcodeProduct.caloriesPer100g, protein_g: barcodeOverrides.proteinPer100g ?? selectedBarcodeProduct.proteinPer100g,
    carbs_g: barcodeOverrides.carbsPer100g ?? selectedBarcodeProduct.carbsPer100g, fat_g: barcodeOverrides.fatPer100g ?? selectedBarcodeProduct.fatPer100g,
  };
  const barcodeComplete = NUTRIENT_FIELDS.every(field => barcodeValues[field] !== null);
  const barcodeValueCell = (key: BarcodeKey, label: string, unit: string, tone: string) => {
    if (selectedBarcodeProduct[key] !== null) return <p className={`text-lg font-bold mt-0.5 ${tone}`}>{selectedBarcodeProduct[key]}{unit}</p>;
    return <input aria-label={t("{label} per 100 g from the label", { label: t(label) })} type="number" min="0" step="0.1" inputMode="decimal" placeholder={t("Unknown")} value={barcodeOverrides[key] ?? ""}
      onChange={event => { const value = event.target.value === "" ? NaN : Number(event.target.value); setBarcodeOverrides(current => { const next = { ...current }; if (Number.isFinite(value) && value >= 0) next[key] = value; else delete next[key]; return next; }); }}
      className="mt-1 w-full rounded-lg bg-slate-950 border border-amber-500/50 px-2 py-1 text-center text-white" />;
  };
  const [barcodeInput, setBarcodeInput] = useState("3017620422003");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [productFacts, setProductFacts] = useState<ProductDetails | null>(null);
  const [readingPack, setReadingPack] = useState(false);
  const [barcodeGrams, setBarcodeGrams] = useState(100);
  const [barcodeReady, setBarcodeReady] = useState(true);
  const [barcodeSource, setBarcodeSource] = useState("Demo product — sample data");

  const handleSearchBarcode = useCallback(async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    const requestId = ++barcodeRequest.current;
    setBarcodeInput(codeToSearch.trim());
    setBarcodeLoading(true);
    setBarcodeReady(false);
    setBarcodeError(null);
    try {
      const res = await lookupBarcodeNutrition(codeToSearch.trim());
      if (requestId !== barcodeRequest.current) return;
      setProductFacts({ ...res.details, ingredients: res.ingredients_text, allergens: res.allergens });
      setSelectedBarcodeProduct({
        code: res.barcode,
        name: res.product_name || "Unnamed product",
        brand: res.brand || "Brand not listed",
        serving: res.serving_size || "Not stated",
        caloriesPer100g: res.nutrients_per_100g.energy_kcal,
        proteinPer100g: res.nutrients_per_100g.protein_g,
        carbsPer100g: res.nutrients_per_100g.carbs_g,
        fatPer100g: res.nutrients_per_100g.fat_g,
        attribution: res.attribution,
        novaGroup: res.nova_group || 0,
        novaLabel: res.nova_group === null ? msg("NOVA not assessed") : res.nova_group === 1 ? msg("Unprocessed / Whole Food") : (res.nova_group === 4 ? msg("Ultra-Processed Food (UPF)") : msg("Processed Food")),
        allergens: res.allergens || []
      });
      setBarcodeOverrides({}); setBarcodeReady(true); setBarcodeSource(res.cached ? `${res.source} (saved copy)` : res.source);
    } catch (err) {
      if (requestId === barcodeRequest.current) setBarcodeError(err instanceof Error ? err.message : t("Barcode not found in Open Food Facts."));
    } finally {
      if (requestId === barcodeRequest.current) setBarcodeLoading(false);
    }
  }, [setBarcodeInput, setBarcodeLoading, setBarcodeReady, setBarcodeError, setSelectedBarcodeProduct, setBarcodeSource]);

  // Voice/Text State & AI Parser
  const [voiceTextPrompt, setVoiceTextPrompt] = useState("");
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [parsedVoiceResult, setParsedVoiceResult] = useState<{ title: string; calories: number; protein: number; carbs: number; fat: number; items: { name: string; grams: string; cal: number; p: number; c: number; f: number }[] } | null>(null);
  const [textError, setTextError] = useState("");

  const handleSimulateVoiceParse = async () => {
    if (!voiceTextPrompt.trim()) { setTextError(t("Describe a meal before parsing.")); return; }
    setIsParsingVoice(true);
    setTextError(""); setParsedVoiceResult(null);
    try {
      const res = await parseMealWithAI(voiceTextPrompt);
      if (res && res.components) {
        setParsedVoiceResult({
          title: res.dish_name || `Parsed: "${voiceTextPrompt.slice(0, 35)}..."`,
          calories: res.total_nutrition.calories,
          protein: res.total_nutrition.protein_g,
          carbs: res.total_nutrition.carbs_g,
          fat: res.total_nutrition.fat_g,
          items: res.components.map((c) => ({
            name: c.name,
            grams: `${c.quantity_g}g`,
            cal: c.calories,
            p: c.protein_g,
            c: c.carbs_g,
            f: c.fat_g
          }))
        });
      }
    } catch (error) {
      setTextError(error instanceof Error ? error.message : t("Text analysis failed."));
    } finally {
      setIsParsingVoice(false);
    }
  };

  // Recipe Builder State
  const [recipeServings, setRecipeServings] = useLocalState("trackcal:recipe:servings", 2);
  const [recipeIngredients, setRecipeIngredients] = useLocalState("trackcal:recipe:ingredients", [
    { name: "Boneless Chicken Breast", grams: 300, cal: 495, p: 93, c: 0, f: 11 },
    { name: "Olive Oil", grams: 15, cal: 132, p: 0, c: 0, f: 15 },
    { name: "Jasmine Rice (Dry)", grams: 150, cal: 540, p: 10, c: 120, f: 1 },
    { name: "Broccoli Florets", grams: 120, cal: 41, p: 3, c: 8, f: 0.5 }
  ]);
  const [newIngName, setNewIngName] = useState("");
  const [newIngGrams, setNewIngGrams] = useState(100);
  const [newIngNutrition, setNewIngNutrition] = useState({ cal: 0, p: 0, c: 0, f: 0 });
  const [recipeName, setRecipeName] = useLocalState("trackcal:recipe:name", t("My homemade recipe"));
  const [recipeError, setRecipeError] = useState("");

  const totalRecipeCals = recipeIngredients.reduce((a, b) => a + b.cal, 0);
  const totalRecipePro = recipeIngredients.reduce((a, b) => a + b.p, 0);
  const totalRecipeCarb = recipeIngredients.reduce((a, b) => a + b.c, 0);
  const totalRecipeFat = recipeIngredients.reduce((a, b) => a + b.f, 0);

  const perServingCals = Math.round(totalRecipeCals / (recipeServings || 1));
  const perServingPro = Math.round(totalRecipePro / (recipeServings || 1));
  const perServingCarb = Math.round(totalRecipeCarb / (recipeServings || 1));
  const perServingFat = Math.round(totalRecipeFat / (recipeServings || 1));

  const handleAddIngredient = () => {
    setRecipeError("");
    if (!newIngName.trim() || !Number.isFinite(newIngGrams) || newIngGrams <= 0 || newIngGrams > 20000 || Object.values(newIngNutrition).some(n => !Number.isFinite(n) || n < 0 || n > 20000)) { setRecipeError(t("Enter an ingredient name, a positive gram amount and valid nonnegative nutrition values.")); return; }
    setRecipeIngredients([
      ...recipeIngredients,
      {
        name: newIngName.trim(),
        grams: newIngGrams,
        ...newIngNutrition
      }
    ]);
    setNewIngName("");
    setNewIngNutrition({ cal: 0, p: 0, c: 0, f: 0 });
    setNotice(t("Recipe ingredient saved."));
  };

  const localFoods = SAMPLE_DATABASE.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.allergens.some(allergen => allergen.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredFoods: LibraryFood[] = [...localFoods.map(food => ({ ...food, source: "Sample food" })), ...remoteFoods];
  useEffect(() => {
    if (activeTab !== "database" || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => void searchGlobalFoods(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchGlobalFoods reads the query this effect depends on
  }, [searchQuery, activeTab]);
  const searchGlobalFoods = async () => {
    const id = ++foodSearchRequest.current; setFoodSearchError(""); setFoodSearchLoading(true);
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(searchQuery.trim())}`, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (id !== foodSearchRequest.current) return;
      if (!response.ok) throw new Error(data.error || t("Food search failed."));
      setRemoteFoods(data.results); if (!data.results.length) setFoodSearchError(t("No complete nutrition records found for this query. Try a more specific food name."));
    } catch (error) { if (id === foodSearchRequest.current) setFoodSearchError(error instanceof Error ? error.message : t("Food search failed.")); }
    finally { if (id === foodSearchRequest.current) setFoodSearchLoading(false); }
  };

  return (
    <div className="trackcal-app food-focus min-h-screen flex flex-col font-sans">
      {/* Main Content */}
      <main className="app-main" data-active-tab={activeTab}>
        {notice && <div role="status" className="app-toast"><CheckCircle2 size={16} /><span>{notice}</span><button aria-label={t("Dismiss notification")} onClick={() => setNotice("")}>×</button></div>}
        <header className="food-page-heading"><div><h1>{t(foodNames[activeTab])}</h1><p>{t(foodIntros[activeTab])}</p></div><button className="destination-button" onClick={()=>setShowOnboarding(true)}>{t("My goals")}</button><details className="food-tool-picker"><summary>{t("Choose another food tool")}</summary><div className="destination-mini-grid">{(Object.keys(foodRoutes) as AppTab[]).map(tab=><button key={tab} className="destination-button" aria-current={activeTab===tab?'page':undefined} onClick={()=>navigateTab(tab)}>{foodNames[tab]}</button>)}</div></details></header>
        <MealIdeaTransfer onChoose={idea=>{setVoiceTextPrompt(idea);setActiveTab("voice_text");setNotice(t("Meal idea loaded. Add actual ingredients and quantities, then review the estimate before logging."));}}/>
        <div id="tracking-workspace" className="focused-tool-content"/>
        {/* TAB 1: AI PHOTO SCANNER */}
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <input
                  type="file"
                  aria-label={t("Meal or nutrition label photo")}
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-semibold text-white">{t("Photo of your meal")}</h2>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {t("Choose a photo")}</button>
                </div>

                <button className="food-camera-open" onClick={() => setCameraOpen(true)}><Camera size={20} /> {t("Scan food with camera")}</button>
                <details className="photo-tips" open={!pendingPhoto || undefined}><summary>{t("For an accurate result")}</summary><ul>
                  <li>{t("Hold the phone about 30–40 cm (one forearm) above the plate, tilted at about 45°.")}</li>
                  <li>{t("Fit the whole plate or bowl in the picture, one meal per photo.")}</li>
                  <li>{t("Use daylight or a bright room; avoid strong shadows and flash glare.")}</li>
                  <li>{t("Leave a spoon or your hand beside the plate so the size can be judged.")}</li>
                  <li>{t("Spread mixed dishes like biryani a little so the meat and vegetables show, or add a note such as “mutton biryani, 2 pieces”.")}</li>
                </ul></details>
                {cameraOpen && <FoodCamera consent={photoConsent} onConsent={setPhotoConsent} onClose={() => setCameraOpen(false)} onCapture={file => { setCameraOpen(false); void processPhoto(file); }} />}
                <div className="scan-privacy-card"><label className="scanner-consent"><input type="checkbox" aria-label={t("Allow this photo to be sent to the configured AI provider")} checked={photoConsent} onChange={e=>setPhotoConsent(e.target.checked)}/> {t("Send this photo for AI analysis")}</label><p className="scanner-privacy-note">{t("Optional transfer to the configured AI provider. Without consent, your preview stays local. Review estimates; allergens are not assessed.")}</p><label className="scanner-note">{t("What the photo can't show (optional)")}<input maxLength={300} value={photoNote} onChange={e=>setPhotoNote(e.target.value)} placeholder={t("3 red bananas, apple 170 g")}/></label><div className="account-actions"><a className="destination-button" href="/nutrition#photo-review">{t("Private photo & manual food selection ↗")}</a>{pendingPhoto&&photoConsent&&<button type="button" disabled={isScanning} onClick={()=>void handleImageFileChange({target:{files:[pendingPhoto],value:''}} as unknown as React.ChangeEvent<HTMLInputElement>)}>{t("Analyze selected photo")}</button>}{uploadedImageUrl&&<button type="button" onClick={()=>{photoRequest.current++;setUploadedImageUrl(null);setPendingPhoto(null);if(fileInputRef.current)fileInputRef.current.value='';setScanReady(false);setScanError(t("Local photo removed."));}}>{t("Delete selected photo")}</button>}</div></div>
                <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 relative flex flex-col items-center justify-center p-6 text-center overflow-hidden group">
                  {uploadedImageUrl ? (
                    <img
                      src={uploadedImageUrl}
                      alt={t("Uploaded Food")}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-25"></div>
                  )}

                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>

                  {isScanning ? (
                    <div className="relative z-10 flex flex-col items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-emerald-500/30">
                      <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                      <p className="text-xs font-semibold text-emerald-400 animate-pulse">
                        {t("Estimating food and nutrition with AI…")}</p>
                    </div>
                  ) : (
                    <div className={`z-10 flex flex-col items-center gap-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 backdrop-blur-xs ${uploadedImageUrl ? "scan-photo-caption" : "relative"}`}>
                      {!uploadedImageUrl && <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-0.5">
                        <Utensils className="w-6 h-6" />
                      </div>}
                      <h3 className="font-semibold text-white text-base">{t(scanResult.foodName)}</h3>
                      {!uploadedImageUrl && <p className="text-xs text-slate-400 max-w-xs">{t(scanResult.method)}</p>}
                      {scanSource !== "none" && !uploadedImageUrl && <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t("Estimate — review portions and ingredients")}</div>}
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce"></div>
                  )}
                </div>

                <div className="mt-6">
                  {scanError && <p role="alert" className="text-rose-300 text-sm mb-3">{scanError}</p>}
                  <p className="text-xs font-medium text-slate-400 mb-2.5">{t("Demo meals (sample data):")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SCAN_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.label}
                        onClick={() => handleSimulateScan(idx)}
                        disabled={isScanning}
                        className={`text-left text-xs p-2.5 rounded-xl border transition-all ${
                          selectedPreset === idx
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <p className="font-semibold">{preset.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t("{calories} kcal", { calories: preset.calories })}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">{t("Explainable AI Breakdown")}</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t("Review AI estimates against the food and portion you actually ate. Photos cannot measure food weight or hidden ingredients; correct the saved entry in your journal.")}</p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">{t("NOVA Score")}</p>
                    <p className={`text-xs font-bold ${scanResult.nova.color} mt-0.5`}>{scanResult.nova.group ? t("Group {group}", { group: scanResult.nova.group }) : t("Not assessed")}</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">{t("Plate Area")}</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{t("Not measured")}</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">{t("Density Model")}</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{t("Not measured")}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                      {scanSource === "photo" ? t("Detected classification") : scanSource === "sample" ? t("Sample result, not your meal") : t("Waiting for a scan")}
                    </span>
                    <h2 id="scan-result-title" className="text-2xl font-bold text-white mt-1">{t(scanResult.foodName)}</h2>
                    {scanSource === "photo" && pendingPhoto && <div className="dish-fix" role="group" aria-label={t("Correct the dish")}>
                      {photoOffline && <p className="dish-offline" role="status">{t("The AI is busy, so the dish was recognised without it. Calories are for a typical portion: check the grams before saving.")}</p>}
                      <span>{t("Not right? Pick or type the dish:")}</span>
                      <div className="dish-fix-options">{dishOptions.map(name => <button key={name} type="button" disabled={isScanning} onClick={() => void processPhoto(pendingPhoto, name)}>{name}</button>)}</div>
                      <form className="dish-fix-form" onSubmit={e => { e.preventDefault(); if (dishFix.trim()) void processPhoto(pendingPhoto, dishFix.trim()); }}>
                        <input value={dishFix} maxLength={120} onChange={e => setDishFix(e.target.value)} placeholder={t("e.g. mutton biryani")} aria-label={t("The correct dish")} />
                        <button type="submit" disabled={isScanning || !dishFix.trim()}>{t("Fix")}</button>
                      </form>
                    </div>}
                    {scanSource !== "none" && <p className="text-xs text-slate-400 mt-1">
                      {t("Estimated portions — review and correct in your journal")}</p>}
                  </div>
                  <button
                    onClick={addCurrentScanToLog}
                    disabled={!scanReady || isScanning}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t("Log This Meal")}</button>
                </div>

                {/* Scaled Macro Pills */}
                <div className="grid grid-cols-4 gap-3 mt-6">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-orange-400 mb-1">
                      <Flame className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">{t("Calories")}</p>
                    <p className="text-xl font-bold text-white mt-0.5">{scaledCalories}</p>
                    <span className="text-[11px] text-slate-400">kcal</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-sky-400 mb-1">
                      <Dna className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">{t("Protein")}</p>
                    <p className="text-xl font-bold text-sky-400 mt-0.5">{scaledProtein}g</p>
                    <span className="text-[11px] text-slate-400">{t("Macro: {n}%", { n: Math.round(scaledProtein * 4 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100) })}</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-amber-400 mb-1">
                      <Wheat className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">{t("Carbs")}</p>
                    <p className="text-xl font-bold text-amber-400 mt-0.5">{scaledCarbs}g</p>
                    <span className="text-[11px] text-slate-400">{t("Macro: {n}%", { n: Math.round(scaledCarbs * 4 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100) })}</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-rose-400 mb-1">
                      <Droplet className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">{t("Fat")}</p>
                    <p className="text-xl font-bold text-rose-400 mt-0.5">{scaledFat}g</p>
                    <span className="text-[11px] text-slate-400">{t("Macro: {n}%", { n: Math.round(scaledFat * 9 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100) })}</span>
                  </div>
                </div>

                {/* Interactive Portion Slider */}
                <div className="mt-6 bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">{t("Portion Adjustment (Grams)")}</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {t("{portionGrams} grams", { portionGrams })}</span>
                  </div>
                  <input
                    type="range"
                    aria-label={t("Photo portion grams")}
                    min="1"
                    max={Math.max(2000, parseInt(scanResult.weight) * 2)}
                    step="1"
                    value={portionGrams}
                    onChange={(e) => setPortionGrams(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  {scanSource === "photo" && <label className="share-pot">{t("Shared between")}<select key={scanResult.foodName} aria-label={t("Shared between how many people")} defaultValue="1" onChange={e => setPortionGrams(Math.max(1, Math.round(parseInt(scanResult.weight) / Number(e.target.value))))}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n === 1 ? t("Just me") : `${n} people`}</option>)}</select></label>}
                  {photoRange && scanResult.label === "Uploaded Meal" && (
                    <p role="note" className="photo-range mt-2 text-xs text-slate-300">
                      {t("Likely {low}–{high} g (about {kcalLow}–{kcalHigh} kcal) · {confidence}.", { low: photoRange.grams[0], high: photoRange.grams[1], kcalLow: photoRange.calories[0], kcalHigh: photoRange.calories[1], confidence: t({ High: msg("High confidence"), Medium: msg("Medium confidence"), Low: msg("Low confidence") }[photoRange.confidence]) })}{" "}
                      {photoRange.fromModel ? t("A photo can't weigh food; set the grams you actually ate.") : t("The range is wider when the AI is less sure; set the grams you actually ate.")}</p>
                  )}
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>{t("100g (Light snack)")}</span>
                    <span>{t("350g (Standard)")}</span>
                    <span>{t("800g (Large Feast)")}</span>
                  </div>
                </div>

                {/* Cooking Style & Hidden Oil Selector */}
                <div className="mt-4 bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-300">{t("Cooking Style & Hidden Oil")}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t("Calibrates absorbed ghee, oils, and sauces")}</p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {COOKING_STYLES[cookingStyle].desc}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2">
                    {(Object.keys(COOKING_STYLES) as (keyof typeof COOKING_STYLES)[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setCookingStyle(key)}
                        className={`text-center py-2 px-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          cookingStyle === key
                            ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {t(COOKING_STYLES[key].label)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-item Segmented Breakdown */}
                <div className="mt-6">
                  {scanSource === "photo" && <AllergenAlert sources={[{ level: "possible", texts: [scanResult.foodName, ...scanResult.items.flatMap(item => [item.name, item.ingredients ?? ""])] }]} />}
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">{t("Segmented Food Components ({length})", { length: scanResult.items.length })}</h3>
                  <div className="space-y-2">
                    {scanResult.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <div>
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.count && item.count > 1 ? t("{count} × about {n} g = {total} g", { count: item.count, n: Math.round(parseFloat(item.portion) * scaleFactor / item.count), total: Math.round(parseFloat(item.portion) * scaleFactor) }) : t("Estimated: {total} g", { total: Math.round(parseFloat(item.portion) * scaleFactor) })}{item.edible && item.edible < parseFloat(item.portion) ? t(" · {n} g eaten", { n: Math.round(item.edible * scaleFactor) }) : ""}</p>
                            {item.ingredients && item.ingredients.toLowerCase() !== item.name.toLowerCase() && <p className="text-xs text-slate-400">{item.ingredients}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white">{t("{n} kcal", { n: Math.round(item.cal * scaleFactor * styleMult.calMult) })}</span>
                          <p className="text-[11px] text-slate-400">
                            P: {Math.round(item.p * scaleFactor * 10) / 10}g • C: {Math.round(item.c * scaleFactor * 10) / 10}g • F: {Math.round(item.f * scaleFactor * styleMult.fatMult * 10) / 10}g
                          </p>
                        </div>
                        {scanSource === "photo" && <div className="scan-item-edit">
                          {item.count && <div className="camera-adjust"><button type="button" aria-label={t("One less {name}", { name: item.name })} disabled={item.count <= 1} onClick={() => editScanItem(index, parseFloat(item.portion) * scaleFactor * (item.count! - 1) / item.count!, item.count! - 1)}>−</button><span>{item.count}</span><button type="button" aria-label={t("One more {name}", { name: item.name })} disabled={item.count >= 200} onClick={() => editScanItem(index, parseFloat(item.portion) * scaleFactor * (item.count! + 1) / item.count!, item.count! + 1)}>+</button></div>}
                          <label>{t("Grams")}<input key={item.portion + scaleFactor} type="number" min="1" max="10000" aria-label={t("Grams of {name}", { name: item.name })} defaultValue={Math.round(parseFloat(item.portion) * scaleFactor)} onBlur={e => { const grams = Number(e.target.value); if (grams !== Math.round(parseFloat(item.portion) * scaleFactor)) editScanItem(index, grams); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}/></label>
                          <button type="button" className="account-secondary" aria-label={t("Remove {name}", { name: item.name })} disabled={scanResult.items.length < 2} onClick={() => setPlate(dropDish(scanResult.items, index, scaleFactor))}>{t("Remove")}</button>
                        </div>}
                      </div>
                    ))}
                  </div>
                  {scanSource === "photo" && <AddDish onAdd={(food, grams) => setPlate(addDish(scanResult.items, foodDish(food, grams), scaleFactor))} />}
                </div>

                {/* Allergen & Safety Alerts */}
                {scanResult.allergens.length > 0 && (
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-300">{t("Allergen Flags Detected")}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {scanResult.allergens.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BARCODE SCANNER */}
        {activeTab === "barcode" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t("Scan with your camera")}</h2>
                <p className="text-xs text-slate-400">{t("Scan a barcode, confirm the product match, then review its nutrition.")}</p>
              </div>
            </div>

            {/* Custom Barcode Input */}
            <BarcodeCamera onCode={handleSearchBarcode} />
            <label className="pack-photo">{readingPack ? t("Reading the pack…") : t("Read a photo of the pack")}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={readingPack} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readPack(file); }} /></label>
            <p className="pack-photo-note">{t("For certifications, codes and terms, or a product with no barcode match. The photo is sent to the AI provider and not stored.")}</p>
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  aria-label={t("Barcode number")}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchBarcode(barcodeInput)}
                  placeholder={t("Enter any UPC / EAN barcode (e.g. 3017620422003, 5449000000996, 0030000010204)...")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <button
                onClick={() => handleSearchBarcode(barcodeInput)}
                disabled={barcodeLoading}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {barcodeLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("Searching Open Food Facts...")}</>
                ) : (
                  <>
                    <Barcode className="w-3.5 h-3.5" />
                    {t("Lookup Barcode")}</>
                )}
              </button>
            </div>

            {barcodeError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{barcodeError}</span>
              </div>
            )}

            {/* Test Presets */}
            <p className="text-xs font-semibold text-slate-400 mb-2">{t("Or select a Global Test Barcode:")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {PACKAGED_BARCODE_PRODUCTS.map((prod) => (
                <button
                  key={prod.code}
                  onClick={() => {
                    barcodeRequest.current++; setBarcodeReady(true); setBarcodeError(null); setBarcodeLoading(false); setBarcodeSource("Demo product — sample data");
                    setSelectedBarcodeProduct(prod); setBarcodeOverrides({});
                    setBarcodeInput(prod.code);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedBarcodeProduct.code === prod.code
                      ? "bg-sky-500/15 border-sky-500/50 text-sky-300"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-bold">{prod.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{prod.brand} • {prod.code}</p>
                </button>
              ))}
            </div>

            {productFacts && <ProductFacts facts={productFacts} />}
            {/* Barcode Lookup Result Card */}
            <p className="text-xs text-slate-400 mb-3">{t("Source: {barcodeSource}. Confirm against your packaging label.", { barcodeSource })}</p>
            <label className="block mb-4 text-sm text-slate-300">{t("Amount eaten (grams)")}<input aria-label={t("Barcode amount in grams")} type="number" min="1" max="10000" value={barcodeGrams} onChange={e => setBarcodeGrams(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className="ml-3 w-24 p-2 bg-slate-950 border border-slate-700 rounded-lg" /></label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">{t("UPC: {code}", { code: selectedBarcodeProduct.code })}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {t(selectedBarcodeProduct.novaLabel)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedBarcodeProduct.name}</h3>
                  <p className="text-xs text-slate-400">{t("{brand} • Serving size: {serving}", { brand: selectedBarcodeProduct.brand, serving: selectedBarcodeProduct.serving })}</p>
                </div>

                <button
                  disabled={!barcodeReady || barcodeLoading || !barcodeComplete}
                  onClick={() => {
                    if (!barcodeReady || barcodeLoading || !barcodeComplete) return;
                    const portion = rounded(scale(barcodeValues, barcodeGrams));
                    setNotice(t("Product added to your journal for {journalDate}.", { journalDate }));
                    setLoggedMeals([
                      ...loggedMeals,
                      {
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        name: `${selectedBarcodeProduct.name} (${barcodeGrams}g)`,
                        calories: portion.energy_kcal as number,
                        protein: portion.protein_g as number,
                        carbs: portion.carbs_g as number,
                        fat: portion.fat_g as number,
                        grams: barcodeGrams > 0 ? barcodeGrams : undefined,
                        method: `Barcode (${barcodeSource})`
                      }
                    ]);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {t("+ Log to Journal")}</button>
                {user && barcodeComplete && !barcodeSource.startsWith("Demo") && (
                  <button
                    disabled={barcodeLoading || savingBarcode}
                    onClick={async () => {
                      setSavingBarcode(true);
                      try {
                        // Saved as a favourite: it keeps the corrected per-100 g values and appears first in food search.
                        await wellnessRequest("favorites", { food_key: `barcode-${selectedBarcodeProduct.code}`, item: {
                          name: [selectedBarcodeProduct.name, selectedBarcodeProduct.brand].filter(Boolean).join(" — ").slice(0, 200), grams: 100,
                          nutrients: { calories: barcodeValues.energy_kcal, protein: barcodeValues.protein_g, carbs: barcodeValues.carbs_g, fat: barcodeValues.fat_g },
                          manual_override: Object.keys(barcodeOverrides).length > 0, estimated: false, source: `Barcode ${selectedBarcodeProduct.code}`.slice(0, 90) } });
                        setNotice(t("Saved to your foods. Find it under favourites on the Nutrition page."));
                      } catch (error) { setNotice(error instanceof Error ? error.message : t("Couldn't save this food. Try again.")); }
                      finally { setSavingBarcode(false); }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/60 text-emerald-300"
                  >
                    {savingBarcode ? t("Saving…") : t("Save to my foods")}
                  </button>
                )}
              </div>

              {/* Per 100g Nutrients Grid */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">{t("Calories (100g)")}</p>
                  {barcodeValueCell("caloriesPer100g", "Calories", "", "text-white")}
                  <span className="text-[11px] text-slate-400">kcal</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">{t("Protein (100g)")}</p>
                  {barcodeValueCell("proteinPer100g", "Protein", "g", "text-sky-400")}
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">{t("Carbs (100g)")}</p>
                  {barcodeValueCell("carbsPer100g", "Carbs", "g", "text-amber-400")}
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-400">{t("Fat (100g)")}</p>
                  {barcodeValueCell("fatPer100g", "Fat", "g", "text-rose-400")}
                </div>
              </div>

              {!barcodeComplete && <p role="status" className="mt-4 text-xs text-amber-300">{t("Open Food Facts doesn't list every value for this product. Enter the missing values from the packaging label to log it.")}</p>}
              {barcodeComplete && consistencyWarning(barcodeValues) && <p role="status" className="mt-4 text-xs text-amber-300">{t("These values don't add up (calories compared with protein, carbs and fat). Please double-check the label.")}</p>}
              {selectedBarcodeProduct.attribution && <p className="mt-3 text-[11px] text-slate-400">{selectedBarcodeProduct.attribution}</p>}
              <AllergenAlert sources={[{ level: "declared", texts: selectedBarcodeProduct.allergens }, { level: "possible", texts: [selectedBarcodeProduct.name, productFacts?.ingredients ?? ""] }]} />
              {selectedBarcodeProduct.allergens.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{t("Allergen Warning: Contains {n}", { n: selectedBarcodeProduct.allergens.join(", ") })}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: VOICE & TEXT MEAL LOGGER */}
        {activeTab === "voice_text" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="composer-head"><h2>{t("What did you eat?")}</h2><p>{t("Type it or say it, and we'll work out the calories.")}</p></div>
            <div className="meal-composer">
              <textarea
                aria-label={t("Meal description")}
                maxLength={4000}
                value={voiceTextPrompt}
                onChange={(e) => { setVoiceTextPrompt(e.target.value); setParsedVoiceResult(null); }}
                disabled={isParsingVoice}
                rows={3}
                placeholder={t("2 rotis, a cup of dal and a bowl of curd")}
              />
              <div className="meal-composer-bar">
                <VoiceInput value={voiceTextPrompt} onText={text => { setVoiceTextPrompt(text); setParsedVoiceResult(null); }} />
                <button className="meal-composer-send" onClick={handleSimulateVoiceParse} disabled={isParsingVoice || !voiceTextPrompt.trim()}>
                  {isParsingVoice ? t("Estimating…") : t("Estimate calories")}
                </button>
              </div>
            </div>
            {!voiceTextPrompt && <div className="meal-chips" aria-label={t("Try an example")}>{[msg("Masala dosa with chutney"), msg("2 eggs on toast"), msg("Chicken biryani, one plate")].map(example => <button key={example} type="button" onClick={() => setVoiceTextPrompt(t(example))}>{t(example)}</button>)}</div>}

            {/* Parsed Result */}
            {textError && <p role="alert" className="text-rose-300 text-sm mb-4">{textError}</p>}
            {parsedVoiceResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">{t("Your estimate")}</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{parsedVoiceResult.title}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setNotice(t("Parsed meal added to your journal for {journalDate}.", { journalDate }));
                      setLoggedMeals([
                        ...loggedMeals,
                        {
                          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          name: parsedVoiceResult.title,
                          calories: parsedVoiceResult.calories,
                          protein: parsedVoiceResult.protein,
                          carbs: parsedVoiceResult.carbs,
                          fat: parsedVoiceResult.fat,
                          method: msg("Voice / Text NLP")
                        }
                      ]);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {t("+ Log All to Journal")}</button>
                </div>

                <div className="space-y-2">
                  {parsedVoiceResult.items.map((it) => (
                    <div key={it.name} className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-white">{it.name}</p>
                        <p className="text-[11px] text-slate-400">{t("Weight: {grams}", { grams: it.grams })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{t("{cal} kcal", { cal: it.cal })}</p>
                        <p className="text-[11px] text-slate-400">P:{it.p}g • C:{it.c}g • F:{it.f}g</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DATABASE */}
        {activeTab === "database" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="composer-head"><h2>{t("Find any food")}</h2><p>{t("Over 14,000 foods and dishes, with real serving sizes.")}</p></div>
            <div className="library-search">
              <Search aria-hidden="true" size={18} />
              <input
                type="text"
                aria-label={t("Search food, cuisine, allergen")}
                placeholder={t("Search rice, dosa, banana…")}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setRemoteFoods([]); setFoodSearchError(""); foodSearchRequest.current++; setFoodSearchLoading(false); }}
                onKeyDown={e => { if (e.key === "Enter" && searchQuery.trim().length >= 2) searchGlobalFoods(); }}
              />
              <button aria-label={t("Search global foods")} disabled={foodSearchLoading || searchQuery.trim().length < 2} onClick={searchGlobalFoods}>{foodSearchLoading ? t("Searching…") : t("Search")}</button>
            </div>
            <h3 className="library-label">{searchQuery.trim() ? t("Results") : t("Popular to start with")}</h3>
            {foodSearchError && <p role="alert" className="text-amber-400 text-xs mb-3">{foodSearchError}</p>}
            <div className="food-list">
              {filteredFoods.length === 0 && <p className="p-6 text-center text-slate-400">{t("No matching foods. Try another word, a barcode lookup or add it manually.")}</p>}
              {searchQuery.trim().length >= 2 && <button type="button" className="library-estimate" onClick={() => { setVoiceTextPrompt(searchQuery.trim()); navigateTab("voice_text"); }}>{t("Can't find it? Estimate \"{n}\" with AI", { n: searchQuery.trim() })}</button>}
              {filteredFoods.map(food => <FoodRow key={food.id} food={food} remaining={budgetLeft} onLog={portion => {
                setLoggedMeals([...loggedMeals, { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), ...portion, method: msg("Database Log") }]);
                setNotice(t("{name} added to your journal.", { name: portion.name }));
              }} />)}
            </div>
          </div>
        )}

        {/* TAB 5: MEAL LOGS & MACROS */}
        {activeTab === "logs" && (
          <>
          <JournalTools date={journalDate} onDate={setJournalDate} meals={loggedMeals} setMeals={setLoggedMeals} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4">{t("Meal Journal · {journalDate}", { journalDate })}</h2>
              {deletedMeal && <p role="status" className="journal-undo">{t("Removed {name}.", { name: deletedMeal.meal.name })}{" "}<button type="button" onClick={() => { const rows = [...loggedMeals]; rows.splice(deletedMeal.index, 0, deletedMeal.meal); setLoggedMeals(rows); setDeletedMeal(null); }}>{t("Undo")}</button></p>}
              {loggedMeals.length === 0 && <p className="text-slate-400 text-sm">{t("No meals yet. Add one above or log a reviewed scan.")}</p>}
              <div className="space-y-3">
                {loggedMeals.map((item, idx) => (
                  <div
                    key={idx}
                    className="journal-meal flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.time}
                          </span>
                          <span>•</span>
                          <span>{t(item.method)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="journal-meal-end"><div className="text-right">
                      <p className="text-base font-bold text-white">{t("{calories} kcal", { calories: item.calories })}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.protein}g P • {item.carbs}g C • {item.fat}g F
                      </p>
                    </div>
                    <button type="button" className="journal-meal-delete" aria-label={t("Delete {name}", { name: item.name })} onClick={() => { setDeletedMeal({ meal: item, index: idx }); setLoggedMeals(loggedMeals.filter((_, i) => i !== idx)); }}><Trash2 size={16} aria-hidden="true" /></button></div>
                  </div>
                ))}
              </div>

              {/* AI Coach Suggestion Card */}
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">{t("Meal ideas (sample suggestions)")}</h3>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {t("{budgetLeft} kcal gap", { budgetLeft })}</span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  {t("Your remaining budget for this date is {kcal} kcal and {protein} g protein. These sample ideas are not personalized recommendations:", { kcal: budgetLeft, protein: Math.max(0, targetProtein - loggedMeals.reduce((a, b) => a + b.protein, 0)) })}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">{t("Grilled Salmon Poké (Half Bowl)")}</p>
                      <p className="text-[11px] text-slate-400">{t("230 kcal • 24g Protein • Low Carb")}</p>
                    </div>
                    <button
                      onClick={() => {
                        setLoggedMeals([
                          ...loggedMeals,
                          {
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            name: "Grilled Salmon Poké (AI Coach Recommended)",
                            calories: 230,
                            protein: 24,
                            carbs: 12,
                            fat: 8,
                            method: "AI Coach Fill"
                          }
                        ]);
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
                    >
                      {t("+ Log")}</button>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">{t("Paneer Tikka with Green Mint Chutney")}</p>
                      <p className="text-[11px] text-slate-400">{t("260 kcal • 18g Protein • 5g Carbs")}</p>
                    </div>
                    <button
                      onClick={() => {
                        setLoggedMeals([
                          ...loggedMeals,
                          {
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            name: "Paneer Tikka with Chutney (AI Coach Recommended)",
                            calories: 260,
                            protein: 18,
                            carbs: 5,
                            fat: 14,
                            method: "AI Coach Fill"
                          }
                        ]);
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
                    >
                      {t("+ Log")}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Summary Sidebar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-white text-base mb-4">{t("Daily Nutrition Summary")}</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{t("Total Calories")}</span>
                      <span className="font-bold text-white">
                        {totalCaloriesLogged} / {dailyTarget + workoutBack} kcal{workoutBack > 0 ? t(" (includes +{workoutBack} from your workout)", { workoutBack }) : ""}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${calPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{t("Protein")}</span>
                      <span className="font-bold text-sky-400">
                        {loggedMeals.reduce((a, b) => a + b.protein, 0)}g / {targetProtein}g
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-sky-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, loggedMeals.reduce((a, b) => a + b.protein, 0) / (targetProtein || 1) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{t("Carbohydrates")}</span>
                      <span className="font-bold text-amber-400">
                        {loggedMeals.reduce((a, b) => a + b.carbs, 0)}g / {targetCarbs}g
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, loggedMeals.reduce((a, b) => a + b.carbs, 0) / (targetCarbs || 1) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{t("Dietary Fat")}</span>
                      <span className="font-bold text-rose-400">
                        {loggedMeals.reduce((a, b) => a + b.fat, 0)}g / {targetFat}g
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="bg-rose-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, loggedMeals.reduce((a, b) => a + b.fat, 0) / (targetFat || 1) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>{t("{count} meals logged", { count: loggedMeals.length })}</span>
                <span className="text-emerald-400 font-semibold">{t("Healthy Progress")}</span>
              </div>
            </div>
          </div>
          </>
        )}

        {/* TAB 6: CUSTOM RECIPE BUILDER */}
        {activeTab === "recipes" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t("Build a recipe")}</h2>
                <p className="text-xs text-slate-400">{t("Calculate total dish macros and per-serving yields from raw ingredients")}</p>
              </div>
            </div>

            <label className="block text-xs text-slate-400 mb-4">{t("Recipe name")}<input aria-label={t("Recipe name")} maxLength={200} value={recipeName} onChange={e => setRecipeName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-1" /></label>
            <button disabled={!recipeIngredients.length || !recipeName.trim()} className="mb-4 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" onClick={() => { setLoggedMeals(previous => [...previous, { name: `${recipeName.trim()} (1 of ${recipeServings} servings)`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: perServingCals, protein: perServingPro, carbs: perServingCarb, fat: perServingFat, method: "Recipe" }]); setNotice(t("Recipe serving added to your journal for {journalDate}.", { journalDate })); }}>{t("Log one serving")}</button>
            {/* Servings control */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
              <div>
                <span className="text-xs font-semibold text-white">{t("Servings")}</span>
                <p className="text-[11px] text-slate-400">{t("Divides total recipe nutrition into single portions")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecipeServings(Math.max(1, recipeServings - 1))}
                  aria-label={t("Decrease recipe servings")}
                  disabled={recipeServings <= 1}
                  className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold border border-slate-800 cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-emerald-400 text-sm">{recipeServings}</span>
                <button
                  onClick={() => setRecipeServings(Math.min(100, recipeServings + 1))}
                  aria-label={t("Increase recipe servings")}
                  disabled={recipeServings >= 100}
                  className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold border border-slate-800 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Per-Serving Macro Summary Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">{t("Per Serving")}</p>
                <p className="text-lg font-bold text-white mt-0.5">{perServingCals}</p>
                <span className="text-[11px] text-slate-400">kcal</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">{t("Protein")}</p>
                <p className="text-lg font-bold text-sky-400 mt-0.5">{perServingPro}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">{t("Carbs")}</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{perServingCarb}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">{t("Fat")}</p>
                <p className="text-lg font-bold text-rose-400 mt-0.5">{perServingFat}g</p>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="space-y-2 mb-6">
              {recipeIngredients.map((ing, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-white">{ing.name}</p>
                    <p className="text-[11px] text-slate-400">{ing.grams}g</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-white">{t("{cal} kcal", { cal: ing.cal })}</span>
                    <button
                      onClick={() => setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== i))}
                      aria-label={t("Remove {name}", { name: ing.name })}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add ingredient row */}
            {recipeError && <p role="alert" className="text-rose-400 text-sm mb-3">{recipeError}</p>}
            <p className="text-xs text-slate-400 mb-3">{t("Enter nutrition for the entire ingredient amount below from its label or a trusted source. Values are saved locally; no nutrition is guessed.")}</p>
            <div className="grid grid-cols-4 gap-2 mb-3">{([ ["cal", msg("Calories (kcal)")], ["p", msg("Protein (g)")], ["c", msg("Carbs (g)")], ["f", msg("Fat (g)")] ] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-400">{t(label)}<input aria-label={t("Ingredient {label}", { label: t(label) })} type="number" min="0" step="0.1" value={newIngNutrition[key]} onChange={e => setNewIngNutrition({ ...newIngNutrition, [key]: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" /></label>)}</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("Ingredient name (e.g. Avocado, Paneer, Almonds)...")}
                aria-label={t("Ingredient name")}
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white"
              />
              <input
                type="number"
                placeholder={t("Grams")}
                aria-label={t("Ingredient grams")}
                min="1"
                max="20000"
                value={newIngGrams}
                onChange={(e) => setNewIngGrams(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white text-center"
              />
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                {t("+ Add")}</button>
            </div>
          </div>
        )}

        {/* Onboarding Goal Calculator Modal */}
        {showOnboarding && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div ref={goalDialog} role="dialog" aria-modal="true" aria-label={t("Personalized Goal Calculator")} onKeyDown={e => {
              if (e.key === "Escape") setShowOnboarding(false);
              if (e.key === "Tab") {
                const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
              }
            }} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{t("🎯 Personalized Goal Calculator")}</h3>
                  <p className="text-xs text-slate-400">{t("Mifflin-St Jeor TDEE & macro target calibration")}</p>
                </div>
                <button
                  aria-label={t("Close goal calculator")}
                  onClick={() => setShowOnboarding(false)}
                  className="text-slate-400 hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">{t("Target Fitness Goal")}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "lose_weight", label: msg("Fat Loss (-500 kcal)") },
                      { key: "maintain", label: msg("Maintain Weight") },
                      { key: "build_muscle", label: msg("Muscle Gain (+300)") },
                    ].map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setOnboardingForm({ ...onboardingForm, goal: g.key })}
                        className={`p-2 rounded-xl border text-center font-semibold transition-all cursor-pointer ${
                          onboardingForm.goal === g.key
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {t(g.label)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">{t("Biological Sex")}</label>
                    <select
                      aria-label={t("Biological sex")}
                      value={onboardingForm.sex}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, sex: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    >
                      <option value="male">{t("Male")}</option>
                      <option value="female">{t("Female")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">{t("Age (Years)")}</label>
                    <input
                      type="number"
                      aria-label={t("Goal age")}
                      min="18"
                      max="100"
                      value={onboardingForm.age}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, age: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">{t("Weight (kg)")}</label>
                    <input
                      type="number"
                      aria-label={t("Goal weight kg")}
                      min="30"
                      max="350"
                      value={onboardingForm.weight}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, weight: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">{t("Height (cm)")}</label>
                    <input
                      type="number"
                      aria-label={t("Goal height cm")}
                      min="100"
                      max="230"
                      value={onboardingForm.height}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, height: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">{t("Daily Activity Level")}</label>
                  <select
                    aria-label={t("Daily activity level")}
                    value={onboardingForm.activity}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, activity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  >
                    <option value="sedentary">{t("Sedentary (Desk job, little exercise)")}</option>
                    <option value="light">{t("Lightly Active (1-3 workouts / week)")}</option>
                    <option value="moderate">{t("Moderately Active (3-5 workouts / week)")}</option>
                    <option value="very_active">{t("Very Active (6-7 intense sessions / physical job)")}</option>
                  </select>
                </div>
              </div>

              {goalError && <p role="alert" className="text-rose-400 text-sm mt-3">{goalError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  {t("Cancel")}</button>
                <button
                  onClick={calculateAndApplyOnboarding}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {t("Calculate & Apply Targets")}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
