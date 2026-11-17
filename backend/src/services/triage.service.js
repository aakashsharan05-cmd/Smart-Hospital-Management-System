/**
 * AI Symptom Triage Service
 *
 * Provides intelligent, privacy-preserving clinical department recommendation and urgency assessment.
 * Rules:
 *  1. Only symptomText is sent to Gemini (ZERO PII: no name, email, phone, user ID).
 *  2. Symptoms and API keys are NEVER logged.
 *  3. Only active departments from MongoDB are passed to Gemini and accepted.
 *  4. 3.0-second timeout with AbortController, falling back to rule-based triage.
 *  5. Hardcoded disclaimer: "AI suggestion only, not a medical diagnosis."
 *  6. GEMINI_API_KEY and GEMINI_MODEL read from environment.
 */

const Department = require("../models/department.model");

const MANDATORY_DISCLAIMER = "AI suggestion only, not a medical diagnosis.";
const VALID_URGENCIES = ["low", "medium", "high"];

// Keyword-based fallback definitions
const KEYWORD_RULES = [
  {
    department: "Cardiology",
    urgency: "high",
    keywords: [
      "chest pain",
      "heart",
      "palpitation",
      "angina",
      "shortness of breath",
      "breathless",
      "cardiac",
      "heart attack",
      "irregular heartbeat",
      "chest tightness",
      "chest pressure",
      "racing heart",
    ],
  },
  {
    department: "Neurology",
    urgency: "high",
    keywords: [
      "seizure",
      "convulsion",
      "stroke",
      "paralysis",
      "loss of consciousness",
      "fainting",
      "facial drooping",
      "slurred speech",
    ],
  },
  {
    department: "Neurology",
    urgency: "medium",
    keywords: [
      "headache",
      "migraine",
      "dizziness",
      "vertigo",
      "numbness",
      "tremor",
      "tingling sensation",
      "confusion",
      "memory loss",
    ],
  },
  {
    department: "Orthopedics",
    urgency: "medium",
    keywords: [
      "bone",
      "fracture",
      "joint",
      "sprain",
      "dislocation",
      "back pain",
      "knee",
      "spine",
      "arthritis",
      "hip pain",
      "shoulder pain",
      "swollen joint",
      "ligament",
      "muscle tear",
    ],
  },
  {
    department: "Pediatrics",
    urgency: "medium",
    keywords: [
      "child",
      "infant",
      "baby",
      "toddler",
      "pediatric",
      "vaccination",
      "newborn",
      "pediatric fever",
    ],
  },
  {
    department: "Dermatology",
    urgency: "low",
    keywords: [
      "skin",
      "rash",
      "itching",
      "itchy",
      "acne",
      "eczema",
      "psoriasis",
      "mole",
      "allergy",
      "hives",
      "dermatitis",
      "boil",
      "skin lesion",
      "blister",
      "dry skin",
      "red patches",
      "peeling skin",
    ],
  },
  {
    department: "ENT",
    urgency: "low",
    keywords: [
      "ear",
      "hearing",
      "earache",
      "nose",
      "throat",
      "sore throat",
      "sinus",
      "tonsil",
      "nasal",
      "congestion",
      "ear discharge",
      "hoarseness",
      "loss of smell",
      "ringing in ear",
      "tinnitus",
    ],
  },
  {
    department: "Ophthalmology",
    urgency: "low",
    keywords: [
      "burning sensation in my eyes",
      "burning sensation in eye",
      "burning eyes",
      "eye",
      "eyes",
      "vision",
      "blur",
      "blurred",
      "cataract",
      "redness in eye",
      "glasses",
      "sight",
      "stinging eyes",
      "itchy eyes",
      "watery eyes",
      "ocular",
      "irritation in eye",
      "conjunctivitis",
      "double vision",
      "eye pain",
    ],
  },
  {
    department: "General Medicine",
    urgency: "medium",
    keywords: [
      "high fever",
      "severe vomiting",
      "dehydration",
      "food poisoning",
      "persistent vomiting",
      "high temperature",
    ],
  },
  {
    department: "General Medicine",
    urgency: "low",
    keywords: [
      "fever",
      "cold",
      "cough",
      "flu",
      "weakness",
      "fatigue",
      "body ache",
      "stomach ache",
      "headache",
      "nausea",
      "vomiting",
      "malaise",
      "unwell",
      "stomach pain",
      "diarrhea",
      "chills",
      "exhaustion",
      "loss of appetite",
    ],
  },
];

/**
 * Perform rule-based triage matching symptoms against active departments.
 *
 * @param {string} text
 * @param {string[]} activeDepartmentNames
 * @returns {{ suggestedDepartment: string | null, urgency: "low" | "medium" | "high", disclaimer: string }}
 */
const getRuleBasedTriage = (text, activeDepartmentNames = []) => {
  const normalized = (text || "").toLowerCase();

  let matchedDept = null;
  let matchedUrgency = "low";

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      matchedDept = rule.department;
      matchedUrgency = rule.urgency;
      break;
    }
  }

  // Find if General Medicine is among active departments
  const activeGeneralMed = activeDepartmentNames.find(
    (name) => name.toLowerCase() === "general medicine"
  );

  let finalDepartment = null;

  if (matchedDept) {
    // Check if the matched specialty is active in the hospital database
    const directMatch = activeDepartmentNames.find(
      (name) => name.toLowerCase() === matchedDept.toLowerCase()
    );

    if (directMatch) {
      finalDepartment = directMatch;
    } else if (activeGeneralMed) {
      // If the matched specialty is unavailable, use active General Medicine if available
      finalDepartment = activeGeneralMed;
    } else {
      // If General Medicine is also unavailable, return a safe no-suitable-department response (null)
      // rather than blindly assigning an unrelated specialty like Cardiology
      finalDepartment = null;
    }
  } else {
    // Unclear or generic symptoms (no specific keyword match)
    // Route to General Medicine if active; otherwise return null
    if (activeGeneralMed) {
      finalDepartment = activeGeneralMed;
    } else {
      finalDepartment = null;
    }
  }

  return {
    suggestedDepartment: finalDepartment,
    urgency: matchedUrgency,
    disclaimer: MANDATORY_DISCLAIMER,
  };
};

/**
 * Generate symptom triage recommendation using Gemini API with 3.0s timeout and active department validation.
 *
 * @param {string} symptomText
 * @returns {Promise<{ suggestedDepartment: string | null, urgency: "low" | "medium" | "high", disclaimer: string }>}
 */
const triageSymptoms = async (symptomText) => {
  // Fetch only active departments from MongoDB
  const activeDepartments = await Department.find({ isActive: true }).select("name");
  const activeDepartmentNames = activeDepartments.map((d) => d.name.trim());

  // If no active departments in DB, fallback safely
  if (activeDepartmentNames.length === 0) {
    return {
      suggestedDepartment: null,
      urgency: "low",
      disclaimer: MANDATORY_DISCLAIMER,
    };
  }

  const cleanedText = typeof symptomText === "string" ? symptomText.trim() : "";
  if (!cleanedText) {
    return getRuleBasedTriage("", activeDepartmentNames);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  // If no API key configured, use rule-based fallback immediately
  if (!apiKey || !apiKey.trim()) {
    return getRuleBasedTriage(cleanedText, activeDepartmentNames);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  // Strict clinical triage prompt - ONLY symptoms, ZERO PII
  const prompt = [
    `You are an outpatient hospital triage assistant.`,
    `Analyze the patient symptoms below and recommend the most suitable department and urgency level.`,
    `Allowed active departments: ${JSON.stringify(activeDepartmentNames)}.`,
    `Allowed urgency levels: ["low", "medium", "high"].`,
    `You MUST choose a department strictly from the allowed active departments list above.`,
    `Return ONLY a raw JSON object with keys "suggestedDepartment" and "urgency".`,
    `Do not include markdown code fences, headers, or any other text.`,
    `Symptoms: ${cleanedText}`,
  ].join("\n");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
        Connection: "close",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Non-200 response from Gemini; fall back silently without logging API key or symptoms
      return getRuleBasedTriage(cleanedText, activeDepartmentNames);
    }

    const data = await response.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText) {
      return getRuleBasedTriage(cleanedText, activeDepartmentNames);
    }

    // Clean potential markdown backticks
    const cleanedJsonStr = candidateText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanedJsonStr);
    const suggested = typeof parsed.suggestedDepartment === "string" ? parsed.suggestedDepartment.trim() : "";
    const urgency = typeof parsed.urgency === "string" ? parsed.urgency.trim().toLowerCase() : "";

    // Strictly validate against active department list
    const validDepartment = activeDepartmentNames.find(
      (dept) => dept.toLowerCase() === suggested.toLowerCase()
    );

    const validUrgency = VALID_URGENCIES.includes(urgency) ? urgency : null;

    if (validDepartment && validUrgency) {
      return {
        suggestedDepartment: validDepartment,
        urgency: validUrgency,
        disclaimer: MANDATORY_DISCLAIMER,
      };
    }

    // Invalid department or urgency returned by Gemini -> use rule-based fallback
    return getRuleBasedTriage(cleanedText, activeDepartmentNames);
  } catch (err) {
    clearTimeout(timeoutId);
    // Timeout (AbortError) or network failure -> fallback silently
    return getRuleBasedTriage(cleanedText, activeDepartmentNames);
  }
};

module.exports = {
  triageSymptoms,
  getRuleBasedTriage,
  MANDATORY_DISCLAIMER,
};
