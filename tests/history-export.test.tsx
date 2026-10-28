import { fireEvent,render,screen } from "@testing-library/react";
import { it,expect,vi } from "vitest";
import { foodHistoryCsv,parseFoodHistory,mergeFoodHistory } from "../src/lib/food-history";
import { HistoryExport } from "../src/components/history-export";
const meal={name:'Rice, "beans"',time:'01:05 PM',calories:400,protein:20,carbs:50,fat:12,method:'Manual entry'};
it('exports a selected range with quoted names and normalized clock times that reimports without duplicates',()=>{
  const entries={'trackcal:journal:2026-10-23':[meal], 'trackcal:journal:2026-10-22':[meal], 'trackcal:target:calories':2000};
  const csv=foodHistoryCsv(entries,'2026-10-23','2026-10-23');const rows=parseFoodHistory(csv);
  expect(rows).toHaveLength(1);expect(rows[0].meal).toMatchObject({...meal,time:'13:05',method:'Reviewed CSV import'});
  const imported=mergeFoodHistory({},rows);expect(mergeFoodHistory(imported.entries,rows).duplicates).toBe(1);
  expect(mergeFoodHistory(entries,rows).duplicates).toBe(1);
  expect(csv).not.toContain('2000');
});
it('protects formula-like names and refuses empty, malformed or reversed exports',()=>{
  const entry={'trackcal:journal:2026-10-23':[{...meal,name:'=HYPERLINK("bad")'}]};
  expect(parseFoodHistory(foodHistoryCsv(entry,'2026-10-23','2026-10-23'))[0].meal.name).toMatch(/^'/);
  for(const [entries,from,to] of [[{},'2026-10-23','2026-10-23'],[entry,'2026-10-24','2026-10-23'],[entry,'2026-02-30','2026-10-23'],[{'trackcal:journal:2026-10-23':[{...meal,time:'bad'}]},'2026-10-23','2026-10-23']] as const)expect(()=>foodHistoryCsv(entries,from,to)).toThrow();
});
it('downloads only guest workspace meals and leaves stored data unchanged',()=>{
  localStorage.setItem('trackcal:journal:2026-10-23',JSON.stringify([meal]));
  localStorage.setItem('trackcal:account:another:trackcal:journal:2026-10-23',JSON.stringify([{...meal,name:'Private other account'}]));
  const before=localStorage.getItem('trackcal:journal:2026-10-23');const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  render(<HistoryExport/>);fireEvent.change(screen.getByLabelText('Export from'),{target:{value:'2026-10-23'}});fireEvent.change(screen.getByLabelText('Export through'),{target:{value:'2026-10-23'}});fireEvent.click(screen.getByRole('button',{name:'Download food history CSV'}));
  expect(screen.getByRole('status').textContent).toContain('CSV downloaded');expect(click).toHaveBeenCalledOnce();expect(localStorage.getItem('trackcal:journal:2026-10-23')).toBe(before);click.mockRestore();
});

