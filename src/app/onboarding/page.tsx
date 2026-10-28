"use client";
import {useAccount} from "@/components/account-session";
import {LegacyOnboarding} from "@/components/legacy-onboarding";
import {PersonalOnboarding} from "@/components/personal-onboarding";
export default function Page(){const {ready,user}=useAccount();return !ready?<main className="account-loading">Opening setup…</main>:user?<PersonalOnboarding key={user.id}/>:<LegacyOnboarding/>;}
