"""Wave 2, phase 1: Kannada and Malayalam for the offline journal (public/offline.html), which works without a
connection. Draft: native review needed. Columns: kn, ml."""

LANGS = ['kn', 'ml']

T = {
 "TrackCal · Offline journal": ["TrackCal · ಆಫ್‌ಲೈನ್ ದಿನಚರಿ", "TrackCal · ഓഫ്‌ലൈൻ ജേണൽ"],
 "YOUR DEVICE JOURNAL": ["ನಿಮ್ಮ ಸಾಧನದ ದಿನಚರಿ", "നിങ്ങളുടെ ഉപകരണ ജേണൽ"],
 "A good habit, even offline.": ["ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ಒಳ್ಳೆಯ ಅಭ್ಯಾಸ.", "ഓഫ്‌ലൈനിലും ഒരു നല്ല ശീലം."],
 "Add meals without a connection. Entries go to your guest journal on this device. Sign in and use “Bring guest data into this account” when you reconnect. Private account data is not opened offline.": [
  "ಸಂಪರ್ಕವಿಲ್ಲದೆ ಊಟ ಸೇರಿಸಿ. ನಮೂದುಗಳು ಈ ಸಾಧನದ ಅತಿಥಿ ದಿನಚರಿಗೆ ಹೋಗುತ್ತವೆ. ಮತ್ತೆ ಸಂಪರ್ಕಗೊಂಡಾಗ ಸೈನ್ ಇನ್ ಮಾಡಿ “ಅತಿಥಿ ಡೇಟಾವನ್ನು ಈ ಖಾತೆಗೆ ತನ್ನಿ” ಬಳಸಿ. ಖಾಸಗಿ ಖಾತೆ ಡೇಟಾ ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ತೆರೆಯುವುದಿಲ್ಲ.",
  "കണക്ഷനില്ലാതെ ഭക്ഷണം ചേർക്കൂ. എൻട്രികൾ ഈ ഉപകരണത്തിലെ അതിഥി ജേണലിലേക്ക് പോകും. വീണ്ടും കണക്റ്റ് ചെയ്യുമ്പോൾ സൈൻ ഇൻ ചെയ്ത് “അതിഥി ഡാറ്റ ഈ അക്കൗണ്ടിലേക്ക് കൊണ്ടുവരിക” ഉപയോഗിക്കൂ. സ്വകാര്യ അക്കൗണ്ട് ഡാറ്റ ഓഫ്‌ലൈനിൽ തുറക്കില്ല."],
 "Pip’s offline guidance": ["ಪಿಪ್‌ನ ಆಫ್‌ಲೈನ್ ಮಾರ್ಗದರ್ಶನ", "പിപ്പിന്റെ ഓഫ്‌ലൈൻ മാർഗനിർദേശം"],
 "✳ Pip’s quick guide": ["✳ ಪಿಪ್‌ನ ತ್ವರಿತ ಮಾರ್ಗದರ್ಶಿ", "✳ പിപ്പിന്റെ ദ്രുത ഗൈഡ്"],
 "Choose the date, add the meal and reviewed nutrients, then save it on this device. Export before clearing browser data. This guest journal stays separate from private account records.": [
  "ದಿನಾಂಕ ಆರಿಸಿ, ಊಟ ಮತ್ತು ಪರಿಶೀಲಿಸಿದ ಪೋಷಕಾಂಶಗಳನ್ನು ಸೇರಿಸಿ, ನಂತರ ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಿ. ಬ್ರೌಸರ್ ಡೇಟಾ ಅಳಿಸುವ ಮೊದಲು ರಫ್ತು ಮಾಡಿ. ಈ ಅತಿಥಿ ದಿನಚರಿ ಖಾಸಗಿ ಖಾತೆ ದಾಖಲೆಗಳಿಂದ ಪ್ರತ್ಯೇಕವಾಗಿರುತ್ತದೆ.",
  "തീയതി തിരഞ്ഞെടുത്ത്, ഭക്ഷണവും പരിശോധിച്ച പോഷകങ്ങളും ചേർത്ത്, ഈ ഉപകരണത്തിൽ സേവ് ചെയ്യൂ. ബ്രൗസർ ഡാറ്റ മായ്ക്കുന്നതിന് മുമ്പ് എക്സ്പോർട്ട് ചെയ്യൂ. ഈ അതിഥി ജേണൽ സ്വകാര്യ അക്കൗണ്ട് രേഖകളിൽ നിന്ന് വേറിട്ടുനിൽക്കും."],
 "Meal name": ["ಊಟದ ಹೆಸರು", "ഭക്ഷണത്തിന്റെ പേര്"],
 "Save meal on this device": ["ಈ ಸಾಧನದಲ್ಲಿ ಊಟ ಉಳಿಸಿ", "ഈ ഉപകരണത്തിൽ ഭക്ഷണം സേവ് ചെയ്യുക"],
 "Export guest journal": ["ಅತಿಥಿ ದಿನಚರಿ ರಫ್ತು ಮಾಡಿ", "അതിഥി ജേണൽ എക്സ്പോർട്ട് ചെയ്യുക"],
 "Guest meals on selected date": ["ಆಯ್ಕೆಮಾಡಿದ ದಿನಾಂಕದ ಅತಿಥಿ ಊಟಗಳು", "തിരഞ്ഞെടുത്ത തീയതിയിലെ അതിഥി ഭക്ഷണങ്ങൾ"],
 "Scans, searches and cloud backup require connectivity. Previously queued backups retry when you reopen TrackCal online. Keep this device’s browser data until you export or transfer your entries.": [
  "ಸ್ಕ್ಯಾನ್, ಹುಡುಕಾಟ ಮತ್ತು ಕ್ಲೌಡ್ ಬ್ಯಾಕಪ್‌ಗೆ ಸಂಪರ್ಕ ಬೇಕು. ಹಿಂದೆ ಸಾಲಿನಲ್ಲಿದ್ದ ಬ್ಯಾಕಪ್‌ಗಳು ನೀವು TrackCal ಅನ್ನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಮತ್ತೆ ತೆರೆದಾಗ ಮರುಪ್ರಯತ್ನಿಸುತ್ತವೆ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ರಫ್ತು ಅಥವಾ ವರ್ಗಾಯಿಸುವವರೆಗೆ ಈ ಸಾಧನದ ಬ್ರೌಸರ್ ಡೇಟಾವನ್ನು ಇಟ್ಟುಕೊಳ್ಳಿ.",
  "സ്കാൻ, തിരയൽ, ക്ലൗഡ് ബാക്കപ്പ് എന്നിവയ്ക്ക് കണക്ഷൻ വേണം. നേരത്തെ ക്യൂവിലുള്ള ബാക്കപ്പുകൾ TrackCal ഓൺലൈനിൽ വീണ്ടും തുറക്കുമ്പോൾ വീണ്ടും ശ്രമിക്കും. എൻട്രികൾ എക്സ്പോർട്ട് ചെയ്യുകയോ മാറ്റുകയോ ചെയ്യുന്നതുവരെ ഈ ഉപകരണത്തിലെ ബ്രൗസർ ഡാറ്റ സൂക്ഷിക്കൂ."],
 "{name} · {calories} kcal · {protein} g protein": ["{name} · {calories} ಕೆ.ಕ್ಯಾ · {protein} ಗ್ರಾಂ ಪ್ರೋಟೀನ್", "{name} · {calories} കി.കലോ · {protein} ഗ്രാം പ്രോട്ടീൻ"],
 "Existing journal data needs recovery. Reconnect and export it before adding meals.": ["ಈಗಿರುವ ದಿನಚರಿ ಡೇಟಾ ಮರುಪಡೆಯಬೇಕಿದೆ. ಊಟ ಸೇರಿಸುವ ಮೊದಲು ಮರುಸಂಪರ್ಕಿಸಿ ಮತ್ತು ರಫ್ತು ಮಾಡಿ.", "നിലവിലുള്ള ജേണൽ ഡാറ്റ വീണ്ടെടുക്കണം. ഭക്ഷണം ചേർക്കുന്നതിന് മുമ്പ് വീണ്ടും കണക്റ്റ് ചെയ്ത് എക്സ്പോർട്ട് ചെയ്യൂ."],
 "Check the meal name and nutrition values.": ["ಊಟದ ಹೆಸರು ಮತ್ತು ಪೋಷಣೆ ಮೌಲ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.", "ഭക്ഷണത്തിന്റെ പേരും പോഷക മൂല്യങ്ങളും പരിശോധിക്കൂ."],
 "Meal saved to your guest journal on this device.": ["ಈ ಸಾಧನದ ಅತಿಥಿ ದಿನಚರಿಗೆ ಊಟ ಉಳಿಸಲಾಗಿದೆ.", "ഈ ഉപകരണത്തിലെ അതിഥി ജേണലിൽ ഭക്ഷണം സേവ് ചെയ്തു."],
 "Storage is unavailable. Export before closing this page.": ["ಸಂಗ್ರಹಣೆ ಲಭ್ಯವಿಲ್ಲ. ಈ ಪುಟ ಮುಚ್ಚುವ ಮೊದಲು ರಫ್ತು ಮಾಡಿ.", "സ്റ്റോറേജ് ലഭ്യമല്ല. ഈ പേജ് അടയ്ക്കുന്നതിന് മുമ്പ് എക്സ്പോർട്ട് ചെയ്യൂ."],
 "Export failed. Keep this page open and reconnect to recover your data.": ["ರಫ್ತು ವಿಫಲವಾಯಿತು. ಈ ಪುಟ ತೆರೆದಿಟ್ಟು, ನಿಮ್ಮ ಡೇಟಾ ಮರುಪಡೆಯಲು ಮರುಸಂಪರ್ಕಿಸಿ.", "എക്സ്പോർട്ട് പരാജയപ്പെട്ടു. ഈ പേജ് തുറന്നുവെച്ച് ഡാറ്റ വീണ്ടെടുക്കാൻ വീണ്ടും കണക്റ്റ് ചെയ്യൂ."],
 "Date": ["ದಿನಾಂಕ", "തീയതി"],
 "Calories (kcal)": ["ಕ್ಯಾಲೊರಿ (ಕೆ.ಕ್ಯಾ)", "കലോറി (കി.കലോ)"],
 "Protein (g)": ["ಪ್ರೋಟೀನ್ (ಗ್ರಾಂ)", "പ്രോട്ടീൻ (ഗ്രാം)"],
 "Carbs (g)": ["ಕಾರ್ಬ್ಸ್ (ಗ್ರಾಂ)", "കാർബ്സ് (ഗ്രാം)"],
 "Fat (g)": ["ಕೊಬ್ಬು (ಗ್ರಾಂ)", "കൊഴുപ്പ് (ഗ്രാം)"],
}
