"use client";

import React, { useState } from "react";
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
  Globe2,
  BarChart3,
  Plus,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Clock,
  Layers,
  Utensils,
  Barcode,
  Mic,
  BookOpen,
  Trash2,
  Check
} from "lucide-react";

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
    method: "Multi-component 3D volumetric bounding box estimation"
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
    method: "Depth-assisted segmented contour measurement"
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
    method: "Instance segmentation with density calibration"
  }
];

const PACKAGED_BARCODE_PRODUCTS = [
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scanner" | "barcode" | "voice_text" | "database" | "logs" | "recipes">("scanner");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(SCAN_PRESETS[0]);
  const [portionGrams, setPortionGrams] = useState(360);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  const [dailyTarget, setDailyTarget] = useState(2100);
  const [targetProtein, setTargetProtein] = useState(130);
  const [targetCarbs, setTargetCarbs] = useState(220);
  const [targetFat, setTargetFat] = useState(65);

  const calculateAndApplyOnboarding = () => {
    const { sex, age, weight, height, activity, goal } = onboardingForm;
    let bmr = sex === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;

    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very_active: 1.725
    };
    const tdee = bmr * (multipliers[activity] || 1.4);

    let target = Math.round(tdee);
    if (goal === "lose_weight") target = Math.round(tdee - 500);
    else if (goal === "build_muscle") target = Math.round(tdee + 300);

    const pro = Math.round(weight * 1.8);
    const fat = Math.round((target * 0.25) / 9);
    const carb = Math.round((target - (pro * 4 + fat * 9)) / 4);

    setDailyTarget(target);
    setTargetProtein(pro);
    setTargetCarbs(carb);
    setTargetFat(fat);
    setShowOnboarding(false);
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
    setIsScanning(true);
    setSelectedPreset(presetIndex);
    setTimeout(() => {
      setScanResult(SCAN_PRESETS[presetIndex]);
      const initialWeight = parseInt(SCAN_PRESETS[presetIndex].weight) || 300;
      setPortionGrams(initialWeight);
      setCookingStyle("standard");
      setIsScanning(false);
    }, 700);
  };

  const scaleFactor = portionGrams / (parseInt(scanResult.weight) || 1);
  const styleMult = COOKING_STYLES[cookingStyle];
  const scaledCalories = Math.round(scanResult.calories * scaleFactor * styleMult.calMult);
  const scaledProtein = Math.round(scanResult.protein * scaleFactor);
  const scaledCarbs = Math.round(scanResult.carbs * scaleFactor);
  const scaledFat = Math.round(scanResult.fat * scaleFactor * styleMult.fatMult);

  const [loggedMeals, setLoggedMeals] = useState<any[]>([
    {
      time: "08:30 AM",
      name: "Avocado Sourdough Toast & Greek Yogurt",
      calories: 420,
      protein: 26,
      carbs: 38,
      fat: 18,
      method: "Photo Scan"
    },
    {
      time: "01:15 PM",
      name: "Chicken Biryani (Portion verified)",
      calories: 510,
      protein: 34,
      carbs: 61,
      fat: 15,
      method: "AI Vision"
    }
  ]);

  const totalCaloriesLogged = loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const calPercent = Math.min(100, Math.round((totalCaloriesLogged / (dailyTarget || 2000)) * 100));

  const addCurrentScanToLog = () => {
    setLoggedMeals([
      ...loggedMeals,
      {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        name: `${scanResult.foodName} (${styleMult.label})`,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: scaledCarbs,
        fat: scaledFat,
        method: "AI Vision (Oil Calibrated)"
      }
    ]);
  };

  // Barcode State
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState(PACKAGED_BARCODE_PRODUCTS[0]);
  const [barcodeInput, setBarcodeInput] = useState("3017620422003");

  // Voice/Text State
  const [voiceTextPrompt, setVoiceTextPrompt] = useState("Had 2 rotis, a cup of yellow dal tadka, and a bowl of fresh cucumber curd");
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [parsedVoiceResult, setParsedVoiceResult] = useState<any>({
    title: "North Indian Lunch Combo",
    calories: 440,
    protein: 16,
    carbs: 68,
    fat: 11,
    items: [
      { name: "Whole Wheat Roti (2 pcs)", grams: "100g", cal: 240, p: 7, c: 48, f: 2 },
      { name: "Yellow Dal Tadka (1 cup)", grams: "180g", cal: 150, p: 7, c: 18, f: 5 },
      { name: "Fresh Cucumber Curd / Raita", grams: "120g", cal: 50, p: 2, c: 2, f: 4 }
    ]
  });

  const handleSimulateVoiceParse = () => {
    setIsParsingVoice(true);
    setTimeout(() => {
      setParsedVoiceResult({
        title: `Parsed Meal from: "${voiceTextPrompt.slice(0, 35)}..."`,
        calories: 440,
        protein: 16,
        carbs: 68,
        fat: 11,
        items: [
          { name: "Whole Wheat Roti (2 pcs)", grams: "100g", cal: 240, p: 7, c: 48, f: 2 },
          { name: "Yellow Dal Tadka (1 cup)", grams: "180g", cal: 150, p: 7, c: 18, f: 5 },
          { name: "Fresh Cucumber Curd / Raita", grams: "120g", cal: 50, p: 2, c: 2, f: 4 }
        ]
      });
      setIsParsingVoice(false);
    }, 600);
  };

  // Recipe Builder State
  const [recipeServings, setRecipeServings] = useState(2);
  const [recipeIngredients, setRecipeIngredients] = useState([
    { name: "Boneless Chicken Breast", grams: 300, cal: 495, p: 93, c: 0, f: 11 },
    { name: "Olive Oil", grams: 15, cal: 132, p: 0, c: 0, f: 15 },
    { name: "Jasmine Rice (Dry)", grams: 150, cal: 540, p: 10, c: 120, f: 1 },
    { name: "Broccoli Florets", grams: 120, cal: 41, p: 3, c: 8, f: 0.5 }
  ]);
  const [newIngName, setNewIngName] = useState("");
  const [newIngGrams, setNewIngGrams] = useState(100);

  const totalRecipeCals = recipeIngredients.reduce((a, b) => a + b.cal, 0);
  const totalRecipePro = recipeIngredients.reduce((a, b) => a + b.p, 0);
  const totalRecipeCarb = recipeIngredients.reduce((a, b) => a + b.c, 0);
  const totalRecipeFat = recipeIngredients.reduce((a, b) => a + b.f, 0);

  const perServingCals = Math.round(totalRecipeCals / (recipeServings || 1));
  const perServingPro = Math.round(totalRecipePro / (recipeServings || 1));
  const perServingCarb = Math.round(totalRecipeCarb / (recipeServings || 1));
  const perServingFat = Math.round(totalRecipeFat / (recipeServings || 1));

  const handleAddIngredient = () => {
    if (!newIngName.trim()) return;
    const estimatedCals = Math.round((newIngGrams / 100) * 150);
    setRecipeIngredients([
      ...recipeIngredients,
      {
        name: newIngName.trim(),
        grams: newIngGrams,
        cal: estimatedCals,
        p: Math.round(estimatedCals * 0.1),
        c: Math.round(estimatedCals * 0.12),
        f: Math.round(estimatedCals * 0.03)
      }
    ]);
    setNewIngName("");
  };

  const filteredFoods = SAMPLE_DATABASE.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                TrackCal AI
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Global Platform
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab("scanner")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "scanner"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Photo AI
            </button>
            <button
              onClick={() => setActiveTab("barcode")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "barcode"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Barcode
            </button>
            <button
              onClick={() => setActiveTab("voice_text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "voice_text"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Describe / Voice
            </button>
            <button
              onClick={() => setActiveTab("database")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "database"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Database
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "logs"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Journal & Coach
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "recipes"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Recipe Builder
            </button>
          </nav>

          <div className="hidden sm:flex items-center gap-3 text-xs">
            <button
              onClick={() => setShowOnboarding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/25 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> Goal Calculator
            </button>
            <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              FastAPI: Online (MySQL 8.0)
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner with Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Calories Consumed</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalCaloriesLogged} kcal</h3>
              <p className="text-xs text-emerald-400 mt-1 font-medium">{Math.max(0, dailyTarget - totalCaloriesLogged)} kcal remaining</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Daily Calorie Target</p>
              <h3 className="text-2xl font-bold text-white mt-1">{calPercent}%</h3>
              <div className="w-28 bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${calPercent}%` }}
                ></div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Protein Target</p>
              <h3 className="text-2xl font-bold text-white mt-1">{loggedMeals.reduce((a, b) => a + b.protein, 0)}g / {targetProtein}g</h3>
              <p className="text-xs text-sky-400 mt-1 font-medium">
                {Math.round((loggedMeals.reduce((a, b) => a + b.protein, 0) / (targetProtein || 1)) * 100)}% completed
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Dna className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Global Coverage</p>
              <h3 className="text-2xl font-bold text-white mt-1">12 Cuisines</h3>
              <p className="text-xs text-emerald-400 mt-1 font-medium">USDA + OpenFoodFacts</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Globe2 className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* TAB 1: AI PHOTO SCANNER */}
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-semibold text-white">AI Vision Scanner</h2>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Live Simulator
                  </span>
                </div>

                <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 relative flex flex-col items-center justify-center p-6 text-center overflow-hidden group">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-25"></div>

                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>

                  {isScanning ? (
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                      <p className="text-sm font-medium text-emerald-400 animate-pulse">
                        Segmenting food items & volumetric depth...
                      </p>
                    </div>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                        <Utensils className="w-7 h-7" />
                      </div>
                      <h4 className="font-semibold text-white text-base">{scanResult.foodName}</h4>
                      <p className="text-xs text-slate-400 max-w-xs">{scanResult.method}</p>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {scanResult.confidence}% Confidence
                      </div>
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce"></div>
                  )}
                </div>

                <div className="mt-6">
                  <p className="text-xs font-medium text-slate-400 mb-2.5">Try Scanning Sample Global Meals:</p>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">{preset.calories} kcal</p>
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
                  Unlike black-box models, TrackCal reveals exactly why a meal was classified: visual contouring, color spectrum analysis, and calibrated plate depth references.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">NOVA Score</p>
                    <p className={`text-xs font-bold ${scanResult.nova.color} mt-0.5`}>Group {scanResult.nova.group}</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">Plate Area</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">82% fill</p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">Density Model</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">0.92 g/cm³</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                      Detected Classification
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">{scanResult.foodName}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Multi-component breakdown calculated with calibrated gram weights
                    </p>
                  </div>
                  <button
                    onClick={addCurrentScanToLog}
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
                    <span className="text-[10px] text-slate-400">kcal</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-sky-400 mb-1">
                      <Dna className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Protein</p>
                    <p className="text-xl font-bold text-sky-400 mt-0.5">{scaledProtein}g</p>
                    <span className="text-[10px] text-slate-400">Macro: 28%</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-amber-400 mb-1">
                      <Wheat className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Carbs</p>
                    <p className="text-xl font-bold text-amber-400 mt-0.5">{scaledCarbs}g</p>
                    <span className="text-[10px] text-slate-400">Macro: 48%</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center">
                    <div className="flex items-center justify-center text-rose-400 mb-1">
                      <Droplet className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400">Fat</p>
                    <p className="text-xl font-bold text-rose-400 mt-0.5">{scaledFat}g</p>
                    <span className="text-[10px] text-slate-400">Macro: 24%</span>
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
                    min="100"
                    max="800"
                    step="10"
                    value={portionGrams}
                    onChange={(e) => setPortionGrams(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
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
                      <p className="text-[10px] text-slate-400 mt-0.5">Calibrates absorbed ghee, oils, and sauces</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {COOKING_STYLES[cookingStyle].desc}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2">
                    {(Object.keys(COOKING_STYLES) as (keyof typeof COOKING_STYLES)[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setCookingStyle(key)}
                        className={`text-center py-2 px-1.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
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
                    {scanResult.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <div>
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">Estimated: {item.portion}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white">{item.cal} kcal</span>
                          <p className="text-[10px] text-slate-400">
                            P: {item.p}g • C: {item.c}g • F: {item.f}g
                          </p>
                        </div>
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
                <p className="text-xs text-slate-400">Instant lookup across 3,000,000+ global packaged foods</p>
              </div>
            </div>

            {/* Test Presets */}
            <p className="text-xs font-semibold text-slate-400 mb-2">Select a Global Test Barcode:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {PACKAGED_BARCODE_PRODUCTS.map((prod) => (
                <button
                  key={prod.code}
                  onClick={() => {
                    setSelectedBarcodeProduct(prod);
                    setBarcodeInput(prod.code);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedBarcodeProduct.code === prod.code
                      ? "bg-sky-500/15 border-sky-500/50 text-sky-300"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-bold">{prod.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{prod.brand} • {prod.code}</p>
                </button>
              ))}
            </div>

            {/* Barcode Lookup Result Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      UPC: {selectedBarcodeProduct.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {selectedBarcodeProduct.novaLabel}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedBarcodeProduct.name}</h3>
                  <p className="text-xs text-slate-400">{selectedBarcodeProduct.brand} • Serving size: {selectedBarcodeProduct.serving}</p>
                </div>

                <button
                  onClick={() => {
                    setLoggedMeals([
                      ...loggedMeals,
                      {
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        name: `${selectedBarcodeProduct.name} (${selectedBarcodeProduct.serving})`,
                        calories: selectedBarcodeProduct.servingCalories,
                        protein: Math.round(selectedBarcodeProduct.proteinPer100g * 0.15),
                        carbs: Math.round(selectedBarcodeProduct.carbsPer100g * 0.15),
                        fat: Math.round(selectedBarcodeProduct.fatPer100g * 0.15),
                        method: "Barcode (OpenFoodFacts)"
                      }
                    ]);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  + Log to Journal
                </button>
              </div>

              {/* Per 100g Nutrients Grid */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[10px] text-slate-400">Calories (100g)</p>
                  <p className="text-lg font-bold text-white mt-0.5">{selectedBarcodeProduct.caloriesPer100g}</p>
                  <span className="text-[10px] text-slate-400">kcal</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[10px] text-slate-400">Protein (100g)</p>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">{selectedBarcodeProduct.proteinPer100g}g</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-center border border-slate-800/80">
                  <p className="text-[10px] text-slate-400">Carbs (100g)</p>
                  <p className="text-lg font-bold text-amber-400 mt-0.5">{selectedBarcodeProduct.carbsPer100g}g</p>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 text-center">
                  <p className="text-[10px] text-slate-400">Fat (100g)</p>
                  <p className="text-lg font-bold text-rose-400 mt-0.5">{selectedBarcodeProduct.fatPer100g}g</p>
                </div>
              </div>

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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
              <textarea
                value={voiceTextPrompt}
                onChange={(e) => setVoiceTextPrompt(e.target.value)}
                rows={3}
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
                placeholder="Example: Had 2 scrambled eggs with cheddar cheese, a slice of sourdough toast, and an iced black coffee..."
              />
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  NLP Model: OpenRouter / Gemini
                </div>
                <button
                  onClick={handleSimulateVoiceParse}
                  disabled={isParsingVoice}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  {isParsingVoice ? "Parsing Entities..." : "Parse & Break Down Meal"}
                </button>
              </div>
            </div>

            {/* Parsed Result */}
            {parsedVoiceResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">AI NLP Breakdown</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{parsedVoiceResult.title}</h3>
                  </div>
                  <button
                    onClick={() => {
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
                  {parsedVoiceResult.items.map((it: any) => (
                    <div key={it.name} className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-white">{it.name}</p>
                        <p className="text-[10px] text-slate-400">Weight: {it.grams}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{it.cal} kcal</p>
                        <p className="text-[10px] text-slate-400">P:{it.p}g • C:{it.c}g • F:{it.f}g</p>
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
                  Verified items from USDA, Open Food Facts, and regional Indian/Asian datasets
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search food, cuisine, allergen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

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
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4">Today&apos;s Meal Journal</h2>
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
                      <p className="text-[10px] text-slate-400">
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
                    <h3 className="text-sm font-bold text-white">AI Coach: Fill Remaining Macros</h3>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {Math.max(0, dailyTarget - totalCaloriesLogged)} kcal gap
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Based on your logged meals today, your remaining budget is <strong>{Math.max(0, dailyTarget - totalCaloriesLogged)} kcal</strong> and <strong>{Math.max(0, targetProtein - loggedMeals.reduce((a, b) => a + b.protein, 0))}g protein</strong>. Here are optimal dishes to hit your targets:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">Grilled Salmon Poké (Half Bowl)</p>
                      <p className="text-[10px] text-slate-400">230 kcal • 24g Protein • Low Carb</p>
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
                      className="text-[10px] px-2.5 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
                    >
                      + Log
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-white">Paneer Tikka with Green Mint Chutney</p>
                      <p className="text-[10px] text-slate-400">260 kcal • 18g Protein • 5g Carbs</p>
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
                      className="text-[10px] px-2.5 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
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
                      <div className="bg-sky-400 h-full rounded-full w-2/5"></div>
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
                      <div className="bg-amber-400 h-full rounded-full w-3/5"></div>
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
                      <div className="bg-rose-400 h-full rounded-full w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Streak: 7 Days</span>
                <span className="text-emerald-400 font-semibold">Healthy Progress</span>
              </div>
            </div>
          </div>
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

            {/* Servings control */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
              <div>
                <span className="text-xs font-semibold text-white">Recipe Servings / Batch Portions</span>
                <p className="text-[10px] text-slate-400">Divides total recipe nutrition into single portions</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecipeServings(Math.max(1, recipeServings - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold border border-slate-800 cursor-pointer"
                >
                  -
                </button>
                <span className="w-10 text-center font-bold text-emerald-400 text-sm">{recipeServings}</span>
                <button
                  onClick={() => setRecipeServings(recipeServings + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold border border-slate-800 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Per-Serving Macro Summary Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400">Per Serving</p>
                <p className="text-lg font-bold text-white mt-0.5">{perServingCals}</p>
                <span className="text-[10px] text-slate-400">kcal</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400">Protein</p>
                <p className="text-lg font-bold text-sky-400 mt-0.5">{perServingPro}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400">Carbs</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{perServingCarb}g</p>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-400">Fat</p>
                <p className="text-lg font-bold text-rose-400 mt-0.5">{perServingFat}g</p>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="space-y-2 mb-6">
              {recipeIngredients.map((ing, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <p className="text-xs font-semibold text-white">{ing.name}</p>
                    <p className="text-[10px] text-slate-400">{ing.grams}g</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-white">{ing.cal} kcal</span>
                    <button
                      onClick={() => setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== i))}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add ingredient row */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ingredient name (e.g. Avocado, Paneer, Almonds)..."
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Grams"
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">🎯 Personalized Goal Calculator</h3>
                  <p className="text-xs text-slate-400">Mifflin-St Jeor TDEE & macro target calibration</p>
                </div>
                <button
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
                      value={onboardingForm.weight}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, weight: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={onboardingForm.height}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, height: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Daily Activity Level</label>
                  <select
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
