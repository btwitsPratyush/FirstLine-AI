"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Footer } from "./components/Footer";

// Country codes with flags
const countries = [
    { code: "+1", flag: "🇺🇸", name: "US/CA" },
    { code: "+44", flag: "🇬🇧", name: "UK" },
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+86", flag: "🇨🇳", name: "China" },
    { code: "+81", flag: "🇯🇵", name: "Japan" },
    { code: "+49", flag: "🇩🇪", name: "Germany" },
    { code: "+33", flag: "🇫🇷", name: "France" },
    { code: "+39", flag: "🇮🇹", name: "Italy" },
    { code: "+34", flag: "🇪🇸", name: "Spain" },
    { code: "+61", flag: "🇦🇺", name: "Australia" },
    { code: "+64", flag: "🇳🇿", name: "New Zealand" },
    { code: "+27", flag: "🇿🇦", name: "South Africa" },
    { code: "+55", flag: "🇧🇷", name: "Brazil" },
    { code: "+52", flag: "🇲🇽", name: "Mexico" },
    { code: "+7", flag: "🇷🇺", name: "Russia" },
    { code: "+82", flag: "🇰🇷", name: "South Korea" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+971", flag: "🇦🇪", name: "UAE" },
    { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "+31", flag: "🇳🇱", name: "Netherlands" },
    { code: "+46", flag: "🇸🇪", name: "Sweden" },
    { code: "+47", flag: "🇳🇴", name: "Norway" },
    { code: "+45", flag: "🇩🇰", name: "Denmark" },
    { code: "+41", flag: "🇨🇭", name: "Switzerland" },
    { code: "+32", flag: "🇧🇪", name: "Belgium" },
    { code: "+351", flag: "🇵🇹", name: "Portugal" },
    { code: "+353", flag: "🇮🇪", name: "Ireland" },
    { code: "+48", flag: "🇵🇱", name: "Poland" },
    { code: "+90", flag: "🇹🇷", name: "Turkey" },
    { code: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "+234", flag: "🇳🇬", name: "Nigeria" },
    { code: "+254", flag: "🇰🇪", name: "Kenya" },
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+92", flag: "🇵🇰", name: "Pakistan" },
    { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
    { code: "+94", flag: "🇱🇰", name: "Sri Lanka" },
];

interface AnalysisResult {
    scenario: string;
    overall_rating: {
        score: number;
        summary: string;
    };
    strengths: string[];
    areas_for_improvement: string[];
    information_handling: {
        gathered_correctly: string[];
        missed_or_incorrect: string[];
    };
    action_assessment: {
        appropriate_actions: string[];
        inappropriate_actions: string[];
    };
    efficiency: {
        response_time_rating: number;
        comments: string;
    };
    final_recommendation: string;
    pass_fail: "PASS" | "FAIL";
    callSid?: string;
}

export default function Home() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedCountry, setSelectedCountry] = useState(countries[1]); // Default to UK (+44)
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");
    const [highlightedCountryIndex, setHighlightedCountryIndex] = useState(0);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [callStatus, setCallStatus] = useState<"idle" | "calling" | "in-progress" | "analyzing" | "completed">("idle");
    const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
    const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);


    // Filtered countries for search and keyboard nav
    const filteredCountries = useMemo(() => {
        const search = countrySearch.toLowerCase().trim();
        if (!search) return countries;
        return countries.filter(
            (c) =>
                c.name.toLowerCase().includes(search) ||
                c.code.includes(search) ||
                c.code.replace(/\D/g, "").includes(search)
        );
    }, [countrySearch]);

    // When dropdown opens, set highlighted index to selected country (or 0)
    useEffect(() => {
        if (isCountryDropdownOpen) {
            const idx = filteredCountries.findIndex((c) => c.code === selectedCountry.code);
            setHighlightedCountryIndex(idx >= 0 ? idx : 0);
        }
    }, [isCountryDropdownOpen, selectedCountry.code, filteredCountries]);

    // Keyboard navigation for dropdown
    useEffect(() => {
        if (!isCountryDropdownOpen) return;
        const len = filteredCountries.length;
        if (len === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isSearchFocused = target.getAttribute("data-country-search") === "true";
            if (isSearchFocused && e.key !== "Escape" && e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") {
                return;
            }

            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setHighlightedCountryIndex((i) => (i + 1) % len);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setHighlightedCountryIndex((i) => (i - 1 + len) % len);
                    break;
                case "Enter":
                    e.preventDefault();
                    setSelectedCountry(filteredCountries[highlightedCountryIndex]);
                    setIsCountryDropdownOpen(false);
                    setCountrySearch("");
                    break;
                case "Escape":
                    e.preventDefault();
                    setIsCountryDropdownOpen(false);
                    setCountrySearch("");
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isCountryDropdownOpen, filteredCountries, highlightedCountryIndex]);

    // Close country dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isCountryDropdownOpen) {
                const target = event.target as HTMLElement;
                if (!target.closest(".country-selector-container")) {
                    setIsCountryDropdownOpen(false);
                    setCountrySearch("");
                }
            }
        };
        if (isCountryDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isCountryDropdownOpen]);

    // Poll for analysis when a call is in progress
    useEffect(() => {
        if (!currentCallSid || callStatus === "idle" || callStatus === "completed") return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/analysis?callSid=${currentCallSid}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.scenario) {
                        setLastAnalysis(data);
                        setCallStatus("completed");
                        setCurrentCallSid(null); // Stop polling
                    }
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [currentCallSid, callStatus]);


    const handleStartSimulation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError(null);
        setLastAnalysis(null);

        // Phone number validation
        let formattedNumber = phoneNumber.trim();
        if (!formattedNumber) {
            setSubmitError("Please enter a phone number");
            setIsSubmitting(false);
            return;
        }

        const digitsOnly = formattedNumber.replace(/\D/g, "");
        formattedNumber = selectedCountry.code + digitsOnly;

        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(formattedNumber)) {
            setSubmitError(`Invalid phone format for ${selectedCountry.name}`);
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch("/api/outbound-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // No scenarioId passed -> Backend picks random
                body: JSON.stringify({ number: formattedNumber }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Call initiated:", data);
                setCurrentCallSid(data.callSid);
                setCallStatus("in-progress");
            } else {
                let errorMessage = "Unable to start simulation.";
                const errText = await response.text();
                try {
                    const errObj = JSON.parse(errText);
                    if (errObj.detail && errObj.detail.includes("unverified")) {
                         errorMessage = "Free Trial limit: You can only call numbers you verified on Twilio. Please select India (+91) for now.";
                    } else {
                         errorMessage = errObj.error || errObj.message || errObj.detail || "Unexpected error occurred.";
                    }
                } catch {
                    errorMessage = errText;
                }
                setSubmitError(errorMessage);
            }
        } catch {
            setSubmitError("Network error. Check backend connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-8 flex flex-col items-center">

            {/* Header */}
            <header className="w-full text-center pt-12 pb-8">
                <h1 className="text-[2.75rem] md:text-6xl font-bold tracking-tight">
                    FirstLine<span className="text-blue-500">AI</span>
                </h1>
                <p className="mt-4 text-sm uppercase tracking-widest text-zinc-500">
                    Emergency Response Training Simulator
                </p>
            </header>

            {/* Main Action Card */}
            <section className="w-full max-w-lg">
                <div className="bg-zinc-900/50 backdrop-blur-lg border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-2 text-center">Start Simulation</h2>
                    <p className="text-zinc-400 text-center mb-8 text-sm">
                        Enter your number to receive a call from a random emergency scenario.
                        Act as the <strong>999 Dispatcher</strong>.
                    </p>

                    <form onSubmit={handleStartSimulation} className="flex flex-col gap-4">
                        <div className="relative flex">
                            {/* Country Code Selector */}
                            <div className="relative country-selector-container z-20">
                                <button
                                    type="button"
                                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                    className="flex items-center gap-2 px-4 py-4 rounded-l-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition"
                                >
                                    <span className="text-xl">{selectedCountry.flag}</span>
                                    <span className="text-sm font-medium">{selectedCountry.code}</span>
                                </button>

                                {isCountryDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
                                        <div className="p-2 sticky top-0 bg-zinc-900 z-10">
                                            <input
                                                data-country-search="true"
                                                type="text"
                                                placeholder="Search..."
                                                value={countrySearch}
                                                onChange={(e) => setCountrySearch(e.target.value)}
                                                className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-sm border-none focus:ring-1 focus:ring-blue-500"
                                                autoFocus
                                            />
                                        </div>
                                        {filteredCountries.map((country, index) => (
                                            <button
                                                key={country.code}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCountry(country);
                                                    setIsCountryDropdownOpen(false);
                                                    setCountrySearch("");
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800 ${index === highlightedCountryIndex ? "bg-zinc-800" : ""
                                                    }`}
                                            >
                                                <span className="text-xl">{country.flag}</span>
                                                <span className="text-sm flex-1">{country.name}</span>
                                                <span className="text-xs text-zinc-500">{country.code}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                                placeholder="Your phone number"
                                className="flex-1 px-4 py-4 rounded-r-xl border border-zinc-700 border-l-0 bg-zinc-900/50 text-lg placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || callStatus === "in-progress"}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform ${isSubmitting || callStatus === "in-progress"
                                    ? "bg-zinc-700 cursor-not-allowed text-zinc-400"
                                    : "bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] shadow-lg shadow-blue-900/20"
                                }`}
                        >
                            {isSubmitting ? "Initiating..." : callStatus === "in-progress" ? "Call in Progress..." : "Simulate Random Emergency"}
                        </button>

                        {submitError && (
                            <div className="bg-red-900/20 border border-red-800/50 text-red-200 p-3 rounded-lg text-center text-sm">
                                {submitError}
                            </div>
                        )}
                    </form>
                </div>
            </section>

            {/* Analysis Results */}
            {lastAnalysis && (
                <section className="w-full max-w-4xl mt-12 animate-fade-in">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                        <div className={`p-6 border-b border-zinc-800 ${lastAnalysis.pass_fail === 'PASS' ? 'bg-green-900/10' : 'bg-red-900/10'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">Analysis Report</h3>
                                    <p className="text-zinc-400 text-sm">Scenario: <span className="text-white font-medium">{lastAnalysis.scenario}</span></p>
                                </div>
                                <div className={`px-4 py-2 rounded-full font-bold text-xl border ${lastAnalysis.pass_fail === 'PASS'
                                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                                    }`}>
                                    {lastAnalysis.pass_fail} • {lastAnalysis.overall_rating.score}/10
                                </div>
                            </div>
                        </div>

                        <div className="p-8 grid md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Strengths</h4>
                                <ul className="space-y-2">
                                    {lastAnalysis.strengths.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                            <span className="text-green-500 mt-1">✓</span> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Areas for Improvement</h4>
                                <ul className="space-y-2">
                                    {lastAnalysis.areas_for_improvement.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                            <span className="text-yellow-500 mt-1">!</span> {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="md:col-span-2 mt-4 pt-6 border-t border-zinc-800">
                                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Final Recommendation</h4>
                                <p className="text-zinc-300 leading-relaxed">{lastAnalysis.final_recommendation}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </div>
    );
}
