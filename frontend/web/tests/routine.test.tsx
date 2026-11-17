import { fireEvent,render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it,expect } from "vitest";
import { parseFoodHistory,mergeFoodHistory } from "../src/lib/food-history";
import { calendarFile } from "../src/lib/calendar";
import { ThemeControl } from "../src/components/theme-control";
import { Reminders } from "../src/components/reminders";
const csv='date,time,name,calories,protein,carbs,fat\n2026-10-22,12:00,"Rice, beans",400,20,50,12';
it("parses quoted food names, preserves unrelated dates and skips repeated imports",()=>{
  const rows=parseFoodHistory(csv);expect(rows[0].meal.name).toBe("Rice, beans");const merged=mergeFoodHistory({'trackcal:target:calories':2100},[...rows,...rows]);expect(merged.added).toBe(1);expect(merged.duplicates).toBe(1);expect(merged.entries['trackcal:target:calories']).toBe(2100);expect(mergeFoodHistory(merged.entries,rows).added).toBe(0);
});
it("rejects missing nutrition, invalid dates and malformed time instead of inventing values",()=>{
  for(const value of [csv.replace(',20,50,12',',,50,12'),csv.replace('2026-10-22','2026-02-30'),csv.replace('12:00','25:99')])expect(()=>parseFoodHistory(value)).toThrow();
});
it("exports private recurring reminders with an alarm and stable event identity",()=>{
  const result=calendarFile([{id:'meal-reminder',title:'Lunch',startsAt:'2026-11-01T12:00:00Z',minutes:15,repeat:'daily',enabled:true}]);expect(result).toContain('RRULE:FREQ=DAILY');expect(result).toContain('BEGIN:VALARM');expect(result).toContain('UID:meal-reminder@trackcal.local');expect(result).toContain('CLASS:PRIVATE');
  expect(()=>calendarFile([])).toThrow();
});
it("persists dark mode and applies it to the actual document",async()=>{
  render(<ThemeControl/>);await userEvent.click(screen.getByRole('radio',{name:'Dark'}));expect(document.documentElement.dataset.theme).toBe('dark');expect(JSON.parse(localStorage.getItem('trackcal:appearance')!)).toBe('dark');
});
it("keeps the original reminder until an edit is saved",async()=>{
  render(<Reminders/>);fireEvent.change(screen.getByLabelText('First reminder'),{target:{value:'2099-01-01T12:00'}});await userEvent.click(screen.getByRole('button',{name:'Save reminder'}));const before=localStorage.getItem('trackcal:reminders');await userEvent.click(screen.getByRole('button',{name:'Edit Meal check-in'}));await userEvent.click(screen.getByRole('button',{name:'Cancel edit'}));expect(localStorage.getItem('trackcal:reminders')).toBe(before);
});
