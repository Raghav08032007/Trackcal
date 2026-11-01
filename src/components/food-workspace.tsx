
import { FoodCamera } from "@/components/food-camera";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { consistencyWarning, FIELDS as NUTRIENT_FIELDS, rounded, scale, type Nutrients } from "@/lib/nutrition-math";
import { useAccount } from "@/components/account-session";
import {confirmAdultForCalculator} from "@/lib/personalization";
import { MealIdeaTransfer } from "@/components/meal-idea-transfer";
import { VoiceInput } from "@/components/voice-input";
import {type AppTab} from "@/components/app-design";
import {useRouter} from "@/lib/navigation";
import {foodRoutes,foodNames} from "@/lib/feature-guide";
import { BarcodeCamera } from "@/components/barcode-camera";
import { JournalTools, type MealLog } from "@/components/journal-tools";
import { useLocalDate, useLocalState } from "@/lib/use-local-state";
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
  Mic,
  BookOpen,
  Trash2,
  Upload,
  Loader2
} from "lucide-react";

import {
  lookupBarcodeNutrition,
  calculateOnboardingPlan,
  parseMealWithAI,
  analyzeMealPhoto
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
    nova: { group: 1, label: "Unprocessed / Whole Food", color: "text-emerald-400" },
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
    nova: { group: 1, label: "Unprocessed / Whole Food", color: "text-emerald-400" },
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
    novaLabel: "Ultra-Processed Food (UPF)",
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
  if (!ready) return <main className="account-loading" aria-live="polite">Opening your workspace…</main>;
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
  const [scanResult, setScanResult] = useState<ScanView>(() => ({ ...SCAN_PRESETS[0], label: "", foodName: "Nothing scanned yet", weight: "0g", confidence: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, items: [], allergens: [], method: "Snap or upload a meal to see its estimate." } as ScanView));
  const [scanSource, setScanSource] = useState<ScanSource>("none");
  const [portionGrams, setPortionGrams] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteFoods, setRemoteFoods] = useState<FoodItem[]>([]);
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

  const [dailyTarget, setDailyTarget] = useLocalState("trackcal:target:calories", 2100);
  const [targetProtein, setTargetProtein] = useLocalState("trackcal:target:protein", 130);
  const [targetCarbs, setTargetCarbs] = useLocalState("trackcal:target:carbs", 220);
  const [targetFat, setTargetFat] = useLocalState("trackcal:target:fat", 65);

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
  const [cameraOpen,setCameraOpen]=useState(false);
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; await processPhoto(file); e.target.value = ""; };
  const processPhoto = async (file?: File) => {
    if (file) {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024){setScanError('Use a nonempty JPEG, PNG or WebP under 10 MB.');setScanReady(false);return;}
      setPendingPhoto(file); setPhotoRange(null);
      const requestId = ++photoRequest.current;
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      const url = URL.createObjectURL(file);
      setUploadedImageUrl(url);
      if(!photoConsent){setIsScanning(false);setScanReady(false);setScanError('Photo stays on this device. Confirm AI consent or choose a food manually in the cloud diary.');return;}
      setIsScanning(true);
      setScanError(""); setScanReady(false);
      try {
        const result = await analyzeMealPhoto(file, photoNote);
        if (requestId !== photoRequest.current) return;
        const grams = Math.round(result.components.reduce((sum, item) => sum + item.quantity_g, 0));
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
      } catch (error) { if (requestId === photoRequest.current) setScanError(error instanceof Error ? error.message : "Photo analysis failed."); }
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
    setNotice(`Your target is ${plan.calorie_target} kcal a day, with ${plan.macros.protein_g} g protein. Track it in Journal.`);
    } catch (error) { setGoalError(error instanceof Error ? error.message : "Unable to calculate goals."); }
  };

  // Cooking Style & Hidden Oil Slider
  const [cookingStyle, setCookingStyle] = useState<"steamed_boiled" | "home_light" | "standard" | "restaurant_heavy" | "deep_fried">("standard");

  const COOKING_STYLES = {
    steamed_boiled: { label: "Steamed / Boiled", calMult: 0.88, fatMult: 0.65, desc: "Zero added oil" },
    home_light: { label: "Home-Cooked Light", calMult: 0.94, fatMult: 0.85, desc: "Minimal cooking oil" },
    standard: { label: "Standard Recipe", calMult: 1.0, fatMult: 1.0, desc: "Balanced baseline" },
    restaurant_heavy: { label: "Restaurant (Ghee/Butter Heavy)", calMult: 1.25, fatMult: 1.45, desc: "+40% hidden fats" },
    deep_fried: { label: "Deep Fried", calMult: 1.48, fatMult: 1.85, desc: "High oil absorption" },
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
    const sum = (pick: (item: ScanItem) => number) => items.reduce((total, item) => total + pick(item), 0), total = Math.round(sum(item => parseFloat(item.portion)));
    setScanResult({ ...scanResult, items, weight: `${total}g`, calories: sum(item => item.cal), protein: sum(item => item.p), carbs: sum(item => item.c), fat: sum(item => item.f) });
    setPortionGrams(total); setPhotoRange(null);
  };

  const today = useLocalDate();
  const [selectedDate, setJournalDate] = useState("");
  const journalDate = selectedDate || today;
  const [loggedMeals, setLoggedMeals] = useLocalState<MealLog[]>(`trackcal:journal:${journalDate}`, []);

  const totalCaloriesLogged = loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const calPercent = Math.min(100, Math.round((totalCaloriesLogged / (dailyTarget || 2000)) * 100));

  const addCurrentScanToLog = () => {
    if (!scanReady || isScanning) return;
    setNotice(`Meal added to your journal for ${journalDate}.`);
    setLoggedMeals([
      ...loggedMeals,
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        name: `${scanResult.foodName} (${styleMult.label})`,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: scaledCarbs,
        fat: scaledFat,
        method: uploadedImageUrl ? "AI estimate (user reviewed)" : "Demo meal (sample data)"
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
    return <input aria-label={`${label} per 100 g from the label`} type="number" min="0" step="0.1" inputMode="decimal" placeholder="Unknown" value={barcodeOverrides[key] ?? ""}
      onChange={event => { const value = event.target.value === "" ? NaN : Number(event.target.value); setBarcodeOverrides(current => { const next = { ...current }; if (Number.isFinite(value) && value >= 0) next[key] = value; else delete next[key]; return next; }); }}
      className="mt-1 w-full rounded-lg bg-slate-950 border border-amber-500/50 px-2 py-1 text-center text-white" />;
  };
  const [barcodeInput, setBarcodeInput] = useState("3017620422003");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
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
        novaLabel: res.nova_group === null ? "NOVA not assessed" : res.nova_group === 1 ? "Unprocessed / Whole Food" : (res.nova_group === 4 ? "Ultra-Processed Food (UPF)" : "Processed Food"),
        allergens: res.allergens || []
      });
      setBarcodeOverrides({}); setBarcodeReady(true); setBarcodeSource(res.cached ? `${res.source} (saved copy)` : res.source);
    } catch (err) {
      if (requestId === barcodeRequest.current) setBarcodeError(err instanceof Error ? err.message : "Barcode not found in Open Food Facts.");
    } finally {
      if (requestId === barcodeRequest.current) setBarcodeLoading(false);
    }
  }, [setBarcodeInput, setBarcodeLoading, setBarcodeReady, setBarcodeError, setSelectedBarcodeProduct, setBarcodeSource]);

  // Voice/Text State & AI Parser
  const [voiceTextPrompt, setVoiceTextPrompt] = useState("Had 2 rotis, a cup of yellow dal tadka, and a bowl of fresh cucumber curd");
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [parsedVoiceResult, setParsedVoiceResult] = useState<{ title: string; calories: number; protein: number; carbs: number; fat: number; items: { name: string; grams: string; cal: number; p: number; c: number; f: number }[] } | null>(null);
  const [textError, setTextError] = useState("");

  const handleSimulateVoiceParse = async () => {
    if (!voiceTextPrompt.trim()) { setTextError("Describe a meal before parsing."); return; }
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
      setTextError(error instanceof Error ? error.message : "Text analysis failed.");
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
  const [recipeName, setRecipeName] = useLocalState("trackcal:recipe:name", "My homemade recipe");
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
    if (!newIngName.trim() || !Number.isFinite(newIngGrams) || newIngGrams <= 0 || newIngGrams > 20000 || Object.values(newIngNutrition).some(n => !Number.isFinite(n) || n < 0 || n > 20000)) { setRecipeError("Enter an ingredient name, a positive gram amount and valid nonnegative nutrition values."); return; }
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
    setNotice("Recipe ingredient saved.");
  };

  const localFoods = SAMPLE_DATABASE.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.allergens.some(allergen => allergen.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredFoods = [...localFoods, ...remoteFoods];
  const searchGlobalFoods = async () => {
    const id = ++foodSearchRequest.current; setFoodSearchError(""); setFoodSearchLoading(true);
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(searchQuery.trim())}`, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (id !== foodSearchRequest.current) return;
      if (!response.ok) throw new Error(data.error || "Food search failed.");
      setRemoteFoods(data.results); if (!data.results.length) setFoodSearchError("No complete nutrition records found for this query. Try a more specific food name.");
    } catch (error) { if (id === foodSearchRequest.current) setFoodSearchError(error instanceof Error ? error.message : "Food search failed."); }
    finally { if (id === foodSearchRequest.current) setFoodSearchLoading(false); }
  };

  return (
    <div className="trackcal-app food-focus min-h-screen flex flex-col font-sans">
      {/* Main Content */}
      <main className="app-main" data-active-tab={activeTab}>
        {notice && <div role="status" className="app-toast"><CheckCircle2 size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
        <header className="food-page-heading"><div><p className="eyebrow">ONE FOCUSED WORKSPACE</p><h1>{foodNames[activeTab]}</h1></div><button className="destination-button" onClick={()=>setShowOnboarding(true)}>My goals</button><details className="food-tool-picker"><summary>Choose another food tool</summary><div className="destination-mini-grid">{(Object.keys(foodRoutes) as AppTab[]).map(tab=><button key={tab} className="destination-button" aria-current={activeTab===tab?'page':undefined} onClick={()=>navigateTab(tab)}>{foodNames[tab]}</button>)}</div></details></header>
        <MealIdeaTransfer onChoose={idea=>{setVoiceTextPrompt(idea);setActiveTab("voice_text");setNotice("Meal idea loaded. Add actual ingredients and quantities, then review the estimate before logging.");}}/>
        <div id="tracking-workspace" className="focused-tool-content"/>
        {/* TAB 1: AI PHOTO SCANNER */}
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <input
                  type="file"
                  aria-label="Meal or nutrition label photo"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-semibold text-white">AI Vision Scanner</h2>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Meal / Label
                  </button>
                </div>

                <button className="food-camera-open" onClick={() => setCameraOpen(true)}><Camera size={20} /> Scan food with camera</button>
                {cameraOpen && <FoodCamera consent={photoConsent} onConsent={setPhotoConsent} onClose={() => setCameraOpen(false)} onCapture={file => { setCameraOpen(false); void processPhoto(file); }} />}
                <div className="scan-privacy-card"><label className="scanner-consent"><input type="checkbox" aria-label="Allow this photo to be sent to the configured AI provider" checked={photoConsent} onChange={e=>setPhotoConsent(e.target.checked)}/> Send this photo for AI analysis</label><p className="scanner-privacy-note">Optional transfer to the configured AI provider. Without consent, your preview stays local. Review estimates; allergens are not assessed.</p><label className="scanner-note">What the photo can&apos;t show (optional)<input maxLength={300} value={photoNote} onChange={e=>setPhotoNote(e.target.value)} placeholder="3 red bananas, apple 170 g"/></label><div className="account-actions"><a className="destination-button" href="/nutrition#photo-review">Private photo & manual food selection ↗</a>{pendingPhoto&&photoConsent&&<button type="button" disabled={isScanning} onClick={()=>void handleImageFileChange({target:{files:[pendingPhoto],value:''}} as unknown as React.ChangeEvent<HTMLInputElement>)}>Analyze selected photo</button>}{uploadedImageUrl&&<button type="button" onClick={()=>{photoRequest.current++;setUploadedImageUrl(null);setPendingPhoto(null);if(fileInputRef.current)fileInputRef.current.value='';setScanReady(false);setScanError('Local photo removed.');}}>Delete selected photo</button>}</div></div>
                <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 relative flex flex-col items-center justify-center p-6 text-center overflow-hidden group">
                  {uploadedImageUrl ? (
                    <img
                      src={uploadedImageUrl}
                      alt="Uploaded Food"
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
                        Estimating food and nutrition with AI…
                      </p>
                    </div>
                  ) : (
                    <div className={`z-10 flex flex-col items-center gap-2 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 backdrop-blur-xs ${uploadedImageUrl ? "scan-photo-caption" : "relative"}`}>
                      {!uploadedImageUrl && <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-0.5">
                        <Utensils className="w-6 h-6" />
                      </div>}
                      <h4 className="font-semibold text-white text-base">{scanResult.foodName}</h4>
                      {!uploadedImageUrl && <p className="text-xs text-slate-400 max-w-xs">{scanResult.method}</p>}
                      {scanSource !== "none" && !uploadedImageUrl && <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Estimate — review portions and ingredients
                      </div>}
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce"></div>
                  )}
                </div>

                <div className="mt-6">
                  {scanError && <p role="alert" className="text-rose-300 text-sm mb-3">{scanError}</p>}
                  <p className="text-xs font-medium text-slate-400 mb-2.5">Demo meals (sample data):</p>
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
                        <p className="text-[11px] text-slate-400 mt-0.5">{preset.calories} kcal</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-white">Explainable AI Breakdown</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Review AI estimates against the food and portion you actually ate. Photos cannot measure food weight or hidden ingredients; correct the saved entry in your journal.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">NOVA Score</p>
                    <p className={`text-xs font-bold ${scanResult.nova.color} mt-0.5`}>{scanResult.nova.group ? `Group ${scanResult.nova.group}` : "Not assessed"}</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">Plate Area</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">Not measured</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[11px] text-slate-400">Density Model</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">Not measured</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                      {scanSource === "photo" ? "Detected classification" : scanSource === "sample" ? "Sample result, not your meal" : "Waiting for a scan"}
                    </span>
                    <h2 id="scan-result-title" className="text-2xl font-bold text-white mt-1">{scanResult.foodName}</h2>
                    {scanSource !== "none" && <p className="text-xs text-slate-400 mt-1">
                      Estimated portions — review and correct in your journal
                    </p>}
                  </div>
                  <button
                    onClick={addCurrentScanToLog}
                    disabled={!scanReady || isScanning}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Log This Meal
                  </button>
                </div>

                {/* Scaled Macro Pills */}
                <div className="grid grid-cols-4 gap-3 mt-6">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-orange-400 mb-1">
                      <Flame className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Calories</p>
                    <p className="text-xl font-bold text-white mt-0.5">{scaledCalories}</p>
                    <span className="text-[11px] text-slate-400">kcal</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-sky-400 mb-1">
                      <Dna className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Protein</p>
                    <p className="text-xl font-bold text-sky-400 mt-0.5">{scaledProtein}g</p>
                    <span className="text-[11px] text-slate-400">Macro: {Math.round(scaledProtein * 4 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100)}%</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-amber-400 mb-1">
                      <Wheat className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Carbs</p>
                    <p className="text-xl font-bold text-amber-400 mt-0.5">{scaledCarbs}g</p>
                    <span className="text-[11px] text-slate-400">Macro: {Math.round(scaledCarbs * 4 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100)}%</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-rose-400 mb-1">
                      <Droplet className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Fat</p>
                    <p className="text-xl font-bold text-rose-400 mt-0.5">{scaledFat}g</p>
                    <span className="text-[11px] text-slate-400">Macro: {Math.round(scaledFat * 9 / (scaledProtein * 4 + scaledCarbs * 4 + scaledFat * 9 || 1) * 100)}%</span>
                  </div>
                </div>

                {/* Interactive Portion Slider */}
                <div className="mt-6 bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">Portion Adjustment (Grams)</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {portionGrams} grams
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Photo portion grams"
                    min="1"
                    max={Math.max(2000, parseInt(scanResult.weight) * 2)}
                    step="1"
                    value={portionGrams}
                    onChange={(e) => setPortionGrams(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  {photoRange && scanResult.label === "Uploaded Meal" && (
                    <p role="note" className="photo-range mt-2 text-xs text-slate-300">
                      Likely <strong>{photoRange.grams[0]}–{photoRange.grams[1]} g</strong> (about {photoRange.calories[0]}–{photoRange.calories[1]} kcal) · {photoRange.confidence} confidence.{" "}
                      {photoRange.fromModel ? "A photo can't weigh food; " : "The range is wider when the AI is less sure; "}set the grams you actually ate.
                    </p>
                  )}
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>100g (Light snack)</span>
                    <span>350g (Standard)</span>
                    <span>800g (Large Feast)</span>
                  </div>
                </div>

                {/* Cooking Style & Hidden Oil Selector */}
                <div className="mt-4 bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-300">Cooking Style & Hidden Oil</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Calibrates absorbed ghee, oils, and sauces</p>
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
                        {COOKING_STYLES[key].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-item Segmented Breakdown */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    Segmented Food Components ({scanResult.items.length})
                  </h4>
                  <div className="space-y-2">
                    {scanResult.items.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <div>
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.count && item.count > 1 ? `${item.count} × about ${Math.round(parseFloat(item.portion) * scaleFactor / item.count)} g = ` : "Estimated: "}{Math.round(parseFloat(item.portion) * scaleFactor)}g{item.edible && item.edible < parseFloat(item.portion) ? ` · ${Math.round(item.edible * scaleFactor)} g eaten` : ""}</p>
                            {item.ingredients && item.ingredients.toLowerCase() !== item.name.toLowerCase() && <p className="text-xs text-slate-400">{item.ingredients}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white">{Math.round(item.cal * scaleFactor * styleMult.calMult)} kcal</span>
                          <p className="text-[11px] text-slate-400">
                            P: {Math.round(item.p * scaleFactor * 10) / 10}g • C: {Math.round(item.c * scaleFactor * 10) / 10}g • F: {Math.round(item.f * scaleFactor * styleMult.fatMult * 10) / 10}g
                          </p>
                        </div>
                        {scanSource === "photo" && <div className="scan-item-edit">
                          {item.count && <div className="camera-adjust"><button type="button" aria-label={`One less ${item.name}`} disabled={item.count <= 1} onClick={() => editScanItem(index, parseFloat(item.portion) * scaleFactor * (item.count! - 1) / item.count!, item.count! - 1)}>−</button><span>{item.count}</span><button type="button" aria-label={`One more ${item.name}`} disabled={item.count >= 200} onClick={() => editScanItem(index, parseFloat(item.portion) * scaleFactor * (item.count! + 1) / item.count!, item.count! + 1)}>+</button></div>}
                          <label>Grams<input key={item.portion + scaleFactor} type="number" min="1" max="10000" aria-label={`Grams of ${item.name}`} defaultValue={Math.round(parseFloat(item.portion) * scaleFactor)} onBlur={e => { const grams = Number(e.target.value); if (grams !== Math.round(parseFloat(item.portion) * scaleFactor)) editScanItem(index, grams); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}/></label>
                        </div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allergen & Safety Alerts */}
                {scanResult.allergens.length > 0 && (
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-semibold text-amber-300">Allergen Flags Detected</h5>
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
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Live Barcode Scanner (Open Food Facts)</h2>
                <p className="text-xs text-slate-400">Scan a barcode, confirm the product match, then review its nutrition.</p>
              </div>
            </div>

            {/* Custom Barcode Input */}
            <BarcodeCamera onCode={handleSearchBarcode} />
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  aria-label="Barcode number"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchBarcode(barcodeInput)}
                  placeholder="Enter any UPC / EAN barcode (e.g. 3017620422003, 5449000000996, 0030000010204)..."
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
                    Searching Open Food Facts...
                  </>
                ) : (
                  <>
                    <Barcode className="w-3.5 h-3.5" />
                    Lookup Barcode
                  </>
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
            <p className="text-xs font-semibold text-slate-400 mb-2">Or select a Global Test Barcode:</p>
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

            {/* Barcode Lookup Result Card */}
            <p className="text-xs text-slate-400 mb-3">Source: {barcodeSource}. Confirm against your packaging label.</p>
            <label className="block mb-4 text-sm text-slate-300">Amount eaten (grams)<input aria-label="Barcode amount in grams" type="number" min="1" max="10000" value={barcodeGrams} onChange={e => setBarcodeGrams(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className="ml-3 w-24 p-2 bg-slate-950 border border-slate-700 rounded-lg" /></label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      UPC: {selectedBarcodeProduct.code}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {selectedBarcodeProduct.novaLabel}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedBarcodeProduct.name}</h3>
                  <p className="text-xs text-slate-400">{selectedBarcodeProduct.brand} • Serving size: {selectedBarcodeProduct.serving}</p>
                </div>

                <button
                  disabled={!barcodeReady || barcodeLoading || !barcodeComplete}
                  onClick={() => {
                    if (!barcodeReady || barcodeLoading || !barcodeComplete) return;
                    const portion = rounded(scale(barcodeValues, barcodeGrams));
                    setNotice(`Product added to your journal for ${journalDate}.`);
                    setLoggedMeals([
                      ...loggedMeals,
                      {
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        name: `${selectedBarcodeProduct.name} (${barcodeGrams}g)`,
                        calories: portion.energy_kcal as number,
                        protein: portion.protein_g as number,
                        carbs: portion.carbs_g as number,
                        fat: portion.fat_g as number,
                        method: `Barcode (${barcodeSource})`
                      }
                    ]);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  + Log to Journal
                </button>
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
                        setNotice("Saved to your foods. Find it under favourites on the Nutrition page.");
                      } catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't save this food. Try again."); }
                      finally { setSavingBarcode(false); }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/60 text-emerald-300"
                  >
                    {savingBarcode ? "Saving…" : "Save to my foods"}
                  </button>
                )}
              </div>

              {/* Per 100g Nutrients Grid */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Calories (100g)</p>
                  {barcodeValueCell("caloriesPer100g", "Calories", "", "text-white")}
                  <span className="text-[11px] text-slate-400">kcal</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Protein (100g)</p>
                  {barcodeValueCell("proteinPer100g", "Protein", "g", "text-sky-400")}
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[11px] text-slate-400">Carbs (100g)</p>
                  {barcodeValueCell("carbsPer100g", "Carbs", "g", "text-amber-400")}
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-400">Fat (100g)</p>
                  {barcodeValueCell("fatPer100g", "Fat", "g", "text-rose-400")}
                </div>
              </div>

              {!barcodeComplete && <p role="status" className="mt-4 text-xs text-amber-300">Open Food Facts doesn&apos;t list every value for this product. Enter the missing values from the packaging label to log it.</p>}
              {barcodeComplete && consistencyWarning(barcodeValues) && <p role="status" className="mt-4 text-xs text-amber-300">These values don&apos;t add up (calories compared with protein, carbs and fat). Please double-check the label.</p>}
              {selectedBarcodeProduct.attribution && <p className="mt-3 text-[11px] text-slate-400">{selectedBarcodeProduct.attribution}</p>}
              {selectedBarcodeProduct.allergens.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Allergen Warning: Contains {selectedBarcodeProduct.allergens.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: VOICE & TEXT MEAL LOGGER */}
        {activeTab === "voice_text" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Describe or Speak Your Meal</h2>
                <p className="text-xs text-slate-400">AI natural language food entity extraction & macro decomposition</p>
              </div>
            </div>

            {/* Input Box */}
            <VoiceInput onText={setVoiceTextPrompt} />
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
              <textarea
                aria-label="Meal description"
                maxLength={4000}
                value={voiceTextPrompt}
                onChange={(e) => { setVoiceTextPrompt(e.target.value); setParsedVoiceResult(null); }}
                disabled={isParsingVoice}
                rows={3}
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
                placeholder="Example: Had 2 scrambled eggs with cheddar cheese, a slice of sourdough toast, and an iced black coffee..."
              />
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  AI estimates · review before saving
                </div>
                <button
                  onClick={handleSimulateVoiceParse}
                  disabled={isParsingVoice || !voiceTextPrompt.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  {isParsingVoice ? "Parsing Entities..." : "Parse & Break Down Meal"}
                </button>
              </div>
            </div>

            {/* Parsed Result */}
            {textError && <p role="alert" className="text-rose-300 text-sm mb-4">{textError}</p>}
            {parsedVoiceResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">AI NLP Breakdown</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{parsedVoiceResult.title}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setNotice(`Parsed meal added to your journal for ${journalDate}.`);
                      setLoggedMeals([
                        ...loggedMeals,
                        {
                          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          name: parsedVoiceResult.title,
                          calories: parsedVoiceResult.calories,
                          protein: parsedVoiceResult.protein,
                          carbs: parsedVoiceResult.carbs,
                          fat: parsedVoiceResult.fat,
                          method: "Voice / Text NLP"
                        }
                      ]);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    + Log All to Journal
                  </button>
                </div>

                <div className="space-y-2">
                  {parsedVoiceResult.items.map((it) => (
                    <div key={it.name} className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-white">{it.name}</p>
                        <p className="text-[11px] text-slate-400">Weight: {it.grams}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{it.cal} kcal</p>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Global Food & Nutrition Catalog</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Starter foods stay available offline. Search USDA for more foods; remote results are per 100g and do not include allergens.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search food, cuisine, allergen..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setRemoteFoods([]); setFoodSearchError(""); foodSearchRequest.current++; setFoodSearchLoading(false); }}
                  onKeyDown={e => { if (e.key === "Enter" && searchQuery.trim().length >= 2) searchGlobalFoods(); }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button disabled={foodSearchLoading || searchQuery.trim().length < 2} onClick={searchGlobalFoods} className="mb-4 px-4 py-2 rounded-lg bg-emerald-500 text-sm">{foodSearchLoading ? "Searching USDA…" : "Search global foods"}</button>
            {foodSearchError && <p role="alert" className="text-amber-400 text-xs mb-3">{foodSearchError}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Food Name</th>
                    <th className="py-3 px-4">Cuisine / Origin</th>
                    <th className="py-3 px-4">Serving Size</th>
                    <th className="py-3 px-4">Calories</th>
                    <th className="py-3 px-4">Macros (P / C / F)</th>
                    <th className="py-3 px-4">Fiber</th>
                    <th className="py-3 px-4">Provenance</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredFoods.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No matching starter foods. Try a barcode lookup or add the meal manually in your journal.</td></tr>}
                  {filteredFoods.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        {f.name}
                        {f.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{f.cuisine}</td>
                      <td className="py-3.5 px-4 text-slate-400">{f.serving_size}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{f.calories} kcal</td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {f.protein}g / {f.carbs}g / {f.fat}g
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{f.fiber}g</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                          {f.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setLoggedMeals([
                              ...loggedMeals,
                              {
                                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                name: f.name,
                                calories: f.calories,
                                protein: f.protein,
                                carbs: f.carbs,
                                fat: f.fat,
                                method: "Database Log"
                              }
                            ]);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: MEAL LOGS & MACROS */}
        {activeTab === "logs" && (
          <>
          <JournalTools date={journalDate} onDate={setJournalDate} meals={loggedMeals} setMeals={setLoggedMeals} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4">Meal Journal · {journalDate}</h2>
              {loggedMeals.length === 0 && <p className="text-slate-400 text-sm">No meals yet. Add one above or log a reviewed scan.</p>}
              <div className="space-y-3">
                {loggedMeals.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.time}
                          </span>
                          <span>•</span>
                          <span>{item.method}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-white">{item.calories} kcal</p>
                      <p className="text-[11px] text-slate-400">
                        {item.protein}g P • {item.carbs}g C • {item.fat}g F
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Coach Suggestion Card */}
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Meal ideas (sample suggestions)</h3>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {Math.max(0, dailyTarget - totalCaloriesLogged)} kcal gap
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Your remaining budget for this date is <strong>{Math.max(0, dailyTarget - totalCaloriesLogged)} kcal</strong> and <strong>{Math.max(0, targetProtein - loggedMeals.reduce((a, b) => a + b.protein, 0))}g protein</strong>. These sample ideas are not personalized recommendations:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">Grilled Salmon Poké (Half Bowl)</p>
                      <p className="text-[11px] text-slate-400">230 kcal • 24g Protein • Low Carb</p>
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
                      + Log
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">Paneer Tikka with Green Mint Chutney</p>
                      <p className="text-[11px] text-slate-400">260 kcal • 18g Protein • 5g Carbs</p>
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
                      + Log
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Summary Sidebar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-white text-base mb-4">Daily Nutrition Summary</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Total Calories</span>
                      <span className="font-bold text-white">
                        {totalCaloriesLogged} / {dailyTarget} kcal
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
                      <span className="text-slate-400">Protein</span>
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
                      <span className="text-slate-400">Carbohydrates</span>
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
                      <span className="text-slate-400">Dietary Fat</span>
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
                <span>{loggedMeals.length} meals logged</span>
                <span className="text-emerald-400 font-semibold">Healthy Progress</span>
              </div>
            </div>
          </div>
          </>
        )}

        {/* TAB 6: CUSTOM RECIPE BUILDER */}
        {activeTab === "recipes" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Custom Recipe Builder & Yield Calculator</h2>
                <p className="text-xs text-slate-400">Calculate total dish macros and per-serving yields from raw ingredients</p>
              </div>
            </div>

            <label className="block text-xs text-slate-400 mb-4">Recipe name<input aria-label="Recipe name" maxLength={200} value={recipeName} onChange={e => setRecipeName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 mt-1" /></label>
            <button disabled={!recipeIngredients.length || !recipeName.trim()} className="mb-4 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" onClick={() => { setLoggedMeals(previous => [...previous, { name: `${recipeName.trim()} (1 of ${recipeServings} servings)`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: perServingCals, protein: perServingPro, carbs: perServingCarb, fat: perServingFat, method: "Recipe" }]); setNotice(`Recipe serving added to your journal for ${journalDate}.`); }}>Log one serving</button>
            {/* Servings control */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
              <div>
                <span className="text-xs font-semibold text-white">Recipe Servings / Batch Portions</span>
                <p className="text-[11px] text-slate-400">Divides total recipe nutrition into single portions</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecipeServings(Math.max(1, recipeServings - 1))}
                  aria-label="Decrease recipe servings"
                  disabled={recipeServings <= 1}
                  className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold border border-slate-800 cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-emerald-400 text-sm">{recipeServings}</span>
                <button
                  onClick={() => setRecipeServings(Math.min(100, recipeServings + 1))}
                  aria-label="Increase recipe servings"
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
                <p className="text-[11px] text-slate-400">Per Serving</p>
                <p className="text-lg font-bold text-white mt-0.5">{perServingCals}</p>
                <span className="text-[11px] text-slate-400">kcal</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">Protein</p>
                <p className="text-lg font-bold text-sky-400 mt-0.5">{perServingPro}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">Carbs</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{perServingCarb}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">Fat</p>
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
                    <span className="text-xs font-bold text-white">{ing.cal} kcal</span>
                    <button
                      onClick={() => setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${ing.name}`}
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
            <p className="text-xs text-slate-400 mb-3">Enter nutrition for the entire ingredient amount below from its label or a trusted source. Values are saved locally; no nutrition is guessed.</p>
            <div className="grid grid-cols-4 gap-2 mb-3">{([ ["cal", "Calories (kcal)"], ["p", "Protein (g)"], ["c", "Carbs (g)"], ["f", "Fat (g)"] ] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}<input aria-label={`Ingredient ${label}`} type="number" min="0" step="0.1" value={newIngNutrition[key]} onChange={e => setNewIngNutrition({ ...newIngNutrition, [key]: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" /></label>)}</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ingredient name (e.g. Avocado, Paneer, Almonds)..."
                aria-label="Ingredient name"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Grams"
                aria-label="Ingredient grams"
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
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Onboarding Goal Calculator Modal */}
        {showOnboarding && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div ref={goalDialog} role="dialog" aria-modal="true" aria-label="Personalized Goal Calculator" onKeyDown={e => {
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
                  <h3 className="text-lg font-bold text-white">🎯 Personalized Goal Calculator</h3>
                  <p className="text-xs text-slate-400">Mifflin-St Jeor TDEE & macro target calibration</p>
                </div>
                <button
                  aria-label="Close goal calculator"
                  onClick={() => setShowOnboarding(false)}
                  className="text-slate-400 hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Target Fitness Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "lose_weight", label: "Fat Loss (-500 kcal)" },
                      { key: "maintain", label: "Maintain Weight" },
                      { key: "build_muscle", label: "Muscle Gain (+300)" },
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
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Biological Sex</label>
                    <select
                      aria-label="Biological sex"
                      value={onboardingForm.sex}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, sex: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Age (Years)</label>
                    <input
                      type="number"
                      aria-label="Goal age"
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
                    <label className="text-slate-300 font-semibold block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      aria-label="Goal weight kg"
                      min="30"
                      max="350"
                      value={onboardingForm.weight}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, weight: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Height (cm)</label>
                    <input
                      type="number"
                      aria-label="Goal height cm"
                      min="100"
                      max="230"
                      value={onboardingForm.height}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, height: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Daily Activity Level</label>
                  <select
                    aria-label="Daily activity level"
                    value={onboardingForm.activity}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, activity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                  >
                    <option value="sedentary">Sedentary (Desk job, little exercise)</option>
                    <option value="light">Lightly Active (1-3 workouts / week)</option>
                    <option value="moderate">Moderately Active (3-5 workouts / week)</option>
                    <option value="very_active">Very Active (6-7 intense sessions / physical job)</option>
                  </select>
                </div>
              </div>

              {goalError && <p role="alert" className="text-rose-400 text-sm mt-3">{goalError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={calculateAndApplyOnboarding}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Calculate & Apply Targets
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
