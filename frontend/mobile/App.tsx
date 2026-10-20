import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Dimensions,
  TextInput,
  StatusBar
} from "react-native";

const { width } = Dimensions.get("window");

interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"today" | "progress" | "profile">("today");
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [waterCups, setWaterCups] = useState(5);
  const [scanResult, setScanResult] = useState<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    grams: number;
    confidence: number;
  } | null>(null);

  const [meals, setMeals] = useState<{
    breakfast: MealItem[];
    lunch: MealItem[];
    dinner: MealItem[];
    snacks: MealItem[];
  }>({
    breakfast: [
      { id: "1", name: "Avocado Sourdough Toast & Poached Egg", calories: 340, protein: 16, carbs: 28, fat: 19, grams: 210 }
    ],
    lunch: [
      { id: "2", name: "Chicken Biryani with Raita", calories: 510, protein: 34, carbs: 61, fat: 15, grams: 360 }
    ],
    dinner: [],
    snacks: []
  });

  const allItems = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
  const totalCalories = allItems.reduce((acc, item) => acc + item.calories, 0);
  const totalProtein = allItems.reduce((acc, item) => acc + item.protein, 0);
  const totalCarbs = allItems.reduce((acc, item) => acc + item.carbs, 0);
  const totalFat = allItems.reduce((acc, item) => acc + item.fat, 0);

  const targetCalories = 2200;
  const remainingCalories = Math.max(0, targetCalories - totalCalories);

  const handleSimulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanResult({
        name: "Grilled Salmon with Steamed Jasmine Rice & Asparagus",
        calories: 460,
        protein: 38,
        carbs: 42,
        fat: 14,
        grams: 340,
        confidence: 97.4
      });
    }, 1200);
  };

  const handleAddScannedMeal = () => {
    if (!scanResult) return;
    setMeals((prev) => ({
      ...prev,
      dinner: [
        ...prev.dinner,
        {
          id: Date.now().toString(),
          name: scanResult.name,
          calories: scanResult.calories,
          protein: scanResult.protein,
          carbs: scanResult.carbs,
          fat: scanResult.fat,
          grams: scanResult.grams
        }
      ]
    }));
    setScanResult(null);
    setCameraModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>TrackCal AI</Text>
          <Text style={styles.dateText}>Tuesday, October 20</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 7 Days</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Calorie & Macro Target Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Daily Calorie Budget</Text>
          <View style={styles.calorieRow}>
            <View>
              <Text style={styles.caloriesRemaining}>{remainingCalories}</Text>
              <Text style={styles.subtext}>Calories remaining</Text>
            </View>
            <View style={styles.budgetRight}>
              <Text style={styles.budgetDetail}>Target: {targetCalories} kcal</Text>
              <Text style={styles.budgetDetail}>Consumed: {totalCalories} kcal</Text>
            </View>
          </View>

          {/* Macro Progress Bars */}
          <View style={styles.macroRow}>
            <View style={styles.macroPill}>
              <Text style={[styles.macroLabel, { color: "#38bdf8" }]}>Protein</Text>
              <Text style={styles.macroVal}>{totalProtein}g / 140g</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (totalProtein / 140) * 100)}%`, backgroundColor: "#38bdf8" }]} />
              </View>
            </View>

            <View style={styles.macroPill}>
              <Text style={[styles.macroLabel, { color: "#fbbf24" }]}>Carbs</Text>
              <Text style={styles.macroVal}>{totalCarbs}g / 220g</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (totalCarbs / 220) * 100)}%`, backgroundColor: "#fbbf24" }]} />
              </View>
            </View>

            <View style={styles.macroPill}>
              <Text style={[styles.macroLabel, { color: "#fb7185" }]}>Fat</Text>
              <Text style={styles.macroVal}>{totalFat}g / 65g</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (totalFat / 65) * 100)}%`, backgroundColor: "#fb7185" }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Snap CTA Banner */}
        <TouchableOpacity style={styles.scanCta} activeOpacity={0.85} onPress={() => setCameraModalVisible(true)}>
          <View style={styles.ctaIconBox}>
            <Text style={{ fontSize: 22 }}>📸</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.ctaTitle}>Snap a Picture to Log Meal</Text>
            <Text style={styles.ctaSubtitle}>AI segments items, portions, and calories</Text>
          </View>
          <Text style={styles.ctaArrow}>➔</Text>
        </TouchableOpacity>

        {/* Hydration Tracker */}
        <View style={styles.waterCard}>
          <View style={styles.waterLeft}>
            <Text style={styles.waterTitle}>💧 Water Intake</Text>
            <Text style={styles.waterSub}>{waterCups * 250} ml / 2,500 ml target</Text>
          </View>
          <View style={styles.waterControls}>
            <TouchableOpacity style={styles.waterBtn} onPress={() => setWaterCups(Math.max(0, waterCups - 1))}>
              <Text style={styles.waterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.waterCount}>{waterCups}</Text>
            <TouchableOpacity style={styles.waterBtn} onPress={() => setWaterCups(waterCups + 1)}>
              <Text style={styles.waterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meals Sections */}
        <View style={styles.mealsContainer}>
          <Text style={styles.sectionHeader}>Today&apos;s Meal Journal</Text>

          {/* Breakfast */}
          <View style={styles.mealSectionCard}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionTitle}>🌅 Breakfast</Text>
              <Text style={styles.mealSectionCalories}>
                {meals.breakfast.reduce((acc, i) => acc + i.calories, 0)} kcal
              </Text>
            </View>
            {meals.breakfast.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.grams}g • P:{item.protein}g C:{item.carbs}g F:{item.fat}g</Text>
                </View>
                <Text style={styles.itemCalories}>{item.calories} kcal</Text>
              </View>
            ))}
          </View>

          {/* Lunch */}
          <View style={styles.mealSectionCard}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionTitle}>☀️ Lunch</Text>
              <Text style={styles.mealSectionCalories}>
                {meals.lunch.reduce((acc, i) => acc + i.calories, 0)} kcal
              </Text>
            </View>
            {meals.lunch.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.grams}g • P:{item.protein}g C:{item.carbs}g F:{item.fat}g</Text>
                </View>
                <Text style={styles.itemCalories}>{item.calories} kcal</Text>
              </View>
            ))}
          </View>

          {/* Dinner */}
          <View style={styles.mealSectionCard}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionTitle}>🌙 Dinner</Text>
              <Text style={styles.mealSectionCalories}>
                {meals.dinner.reduce((acc, i) => acc + i.calories, 0)} kcal
              </Text>
            </View>
            {meals.dinner.length === 0 ? (
              <Text style={styles.emptyMealText}>No food logged for dinner yet</Text>
            ) : (
              meals.dinner.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>{item.grams}g • P:{item.protein}g C:{item.carbs}g F:{item.fat}g</Text>
                  </View>
                  <Text style={styles.itemCalories}>{item.calories} kcal</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Camera & AI Scan Modal */}
      <Modal visible={cameraModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCameraModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>AI Food Scanner</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Viewfinder Simulator */}
          <View style={styles.viewfinder}>
            <View style={styles.reticleTopLeft} />
            <View style={styles.reticleTopRight} />
            <View style={styles.reticleBottomLeft} />
            <View style={styles.reticleBottomRight} />

            {scanning ? (
              <View style={styles.scanningOverlay}>
                <Text style={styles.scanningText}>Analyzing food geometry & ingredients...</Text>
              </View>
            ) : scanResult ? (
              <View style={styles.resultOverlay}>
                <Text style={styles.resultBadge}>✓ {scanResult.confidence}% Confidence</Text>
                <Text style={styles.resultName}>{scanResult.name}</Text>
                <Text style={styles.resultCalories}>{scanResult.calories} kcal</Text>
                <Text style={styles.resultMacros}>
                  {scanResult.grams}g | P: {scanResult.protein}g | C: {scanResult.carbs}g | F: {scanResult.fat}g
                </Text>
              </View>
            ) : (
              <View style={styles.instructionOverlay}>
                <Text style={styles.instructionText}>Center your meal inside the frame</Text>
                <Text style={styles.instructionSub}>Works on plates, bowls, packaged items & drinks</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            {!scanResult ? (
              <TouchableOpacity style={styles.captureBtn} onPress={handleSimulateScan} disabled={scanning}>
                <View style={styles.captureInnerCircle} />
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.retakeBtn} onPress={() => setScanResult(null)}>
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logConfirmBtn} onPress={handleAddScannedMeal}>
                  <Text style={styles.logConfirmBtnText}>Log to Dinner</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937"
  },
  appName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#10b981"
  },
  dateText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2
  },
  streakBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155"
  },
  streakText: {
    color: "#f97316",
    fontSize: 13,
    fontWeight: "bold"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  summaryCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1e293b"
  },
  summaryTitle: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  calorieRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
    marginBottom: 16
  },
  caloriesRemaining: {
    fontSize: 38,
    fontWeight: "800",
    color: "#ffffff"
  },
  subtext: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600"
  },
  budgetRight: {
    alignItems: "flex-end"
  },
  budgetDetail: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 2
  },
  macroRow: {
    flexDirection: "row",
    gap: 8
  },
  macroPill: {
    flex: 1,
    backgroundColor: "#030712",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937"
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: "700"
  },
  macroVal: {
    fontSize: 11,
    color: "#e5e7eb",
    marginTop: 2,
    marginBottom: 6,
    fontWeight: "600"
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#1f2937",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2
  },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064e3b",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#059669"
  },
  ctaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center"
  },
  ctaTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold"
  },
  ctaSubtitle: {
    color: "#a7f3d0",
    fontSize: 11,
    marginTop: 2
  },
  ctaArrow: {
    color: "#34d399",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8
  },
  waterCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#1e293b"
  },
  waterLeft: {},
  waterTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  waterSub: {
    color: "#38bdf8",
    fontSize: 12,
    marginTop: 2
  },
  waterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  waterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center"
  },
  waterBtnText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold"
  },
  waterCount: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold"
  },
  mealsContainer: {
    marginTop: 20
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12
  },
  mealSectionCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b"
  },
  mealSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 8
  },
  mealSectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold"
  },
  mealSectionCalories: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "bold"
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6
  },
  itemName: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "500"
  },
  itemSub: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 2
  },
  itemCalories: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold"
  },
  emptyMealText: {
    color: "#6b7280",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 6
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#030712"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  closeBtn: {
    padding: 8
  },
  closeBtnText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600"
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold"
  },
  viewfinder: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    backgroundColor: "#090d16",
    borderWidth: 1,
    borderColor: "#1e293b",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  reticleTopLeft: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#10b981"
  },
  reticleTopRight: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#10b981"
  },
  reticleBottomLeft: {
    position: "absolute",
    bottom: 20,
    left: 20,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#10b981"
  },
  reticleBottomRight: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#10b981"
  },
  instructionOverlay: {
    alignItems: "center",
    paddingHorizontal: 20
  },
  instructionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center"
  },
  instructionSub: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center"
  },
  scanningOverlay: {
    alignItems: "center"
  },
  scanningText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold"
  },
  resultOverlay: {
    alignItems: "center",
    paddingHorizontal: 20
  },
  resultBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: "#34d399",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8
  },
  resultName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center"
  },
  resultCalories: {
    color: "#10b981",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 6
  },
  resultMacros: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4
  },
  modalActions: {
    padding: 30,
    alignItems: "center"
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  captureInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10b981"
  },
  confirmActions: {
    flexDirection: "row",
    gap: 16,
    width: "100%"
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#1e293b",
    alignItems: "center"
  },
  retakeBtnText: {
    color: "#ffffff",
    fontWeight: "bold"
  },
  logConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#10b981",
    alignItems: "center"
  },
  logConfirmBtnText: {
    color: "#030712",
    fontWeight: "bold"
  }
});
