import { describe, expect, it } from "vitest";
import { addDish, dropDish, foodDish, plateTotals } from "@/lib/plate";

const rice = { name: "Rice", portion: "200g", cal: 260, p: 5, c: 56, f: 1 }, dal = { name: "Dal", portion: "150g", cal: 150, p: 9, c: 20, f: 4 };

describe("correcting a scanned plate", () => {
  it("takes a wrong dish out of the total", () => {
    const left = dropDish([rice, dal], 1, 1);
    expect(left.map(item => item.name)).toEqual(["Rice"]);
    expect(plateTotals(left)).toMatchObject({ weight: "200g", calories: 260, protein: 5 });
  });
  it("keeps the other dishes at the size the slider shows", () => {
    expect(dropDish([rice, dal], 1, .5)[0]).toMatchObject({ portion: "100g", cal: 130 });
    expect(addDish([rice], dal, .5)[0]).toMatchObject({ portion: "100g", cal: 130 });
  });
  it("adds a food at the grams chosen, without scaling the new dish", () => {
    const papad = foodDish({ name: "Papad", serving_size: "100 g", calories: 370, protein: 25, carbs: 60, fat: 3 }, 10);
    expect(papad).toMatchObject({ portion: "10g", cal: 37 });
    expect(plateTotals(addDish([rice], papad, 1))).toMatchObject({ weight: "210g", calories: 297 });
  });
  it("reads values given per serving, and treats an unreadable serving as 100 g", () => {
    expect(foodDish({ name: "Bar", serving_size: "50 g", calories: 200, protein: 0, carbs: 0, fat: 0 }, 25).cal).toBe(100);
    expect(foodDish({ name: "Bar", serving_size: "", calories: 200, protein: 0, carbs: 0, fat: 0 }, 50).cal).toBe(100);
  });
});
