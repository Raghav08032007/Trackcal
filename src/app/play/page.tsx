import { msg } from "@/lib/i18n";
import { AdventureHub } from "@/components/adventure-hub";
import "./play.css";
export const metadata={title:msg("TrackCal Play — Quests, Move Games & Label Detective"),description:"Daily quests, camera sports games (skip rope, shadow boxing, cricket drive, badminton smash) and label-reading puzzles."};
export default function PlayPage(){return <AdventureHub/>;}
