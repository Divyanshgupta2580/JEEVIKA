import { z } from "zod";

export const patientLanguages = {
  en: ["English", "en-IN"],
  hi: ["हिन्दी", "hi-IN"],
  mr: ["मराठी", "mr-IN"],
  pa: ["ਪੰਜਾਬੀ", "pa-IN"],
  ta: ["தமிழ்", "ta-IN"],
  bn: ["বাংলা", "bn-IN"],
  te: ["తెలుగు", "te-IN"],
  gu: ["ગુજરાતી", "gu-IN"],
  kn: ["ಕನ್ನಡ", "kn-IN"],
} as const;
export const patientLanguage = z.enum([
  "en",
  "hi",
  "mr",
  "pa",
  "ta",
  "bn",
  "te",
  "gu",
  "kn",
]);
export const demoPatientIdentity = {
  abha: "91900000000001",
  mobile: "9000000000",
} as const;
export const consentVersion = "kiosk-consent-v1";
export const complaints = [
  "fever",
  "stomach",
  "chest",
  "cough",
  "headache",
  "injury",
  "other",
] as const;
export const sentinelQuestions = [
  "chestPain",
  "breathless",
  "fainting",
  "fever",
  "cough",
  "fatigue",
  "thirst",
] as const;
export type SentinelQuestion = (typeof sentinelQuestions)[number];
export const answer = z.enum(["yes", "no", "unsure"]);
export const interceptorQuestions = [
  "radiation",
  "sweating",
  "pressure",
] as const;
export const needsStemiQuestions = (complaint: string, description: string) =>
  complaint === "stomach" ||
  /acidity|heartburn|indigestion|burning|stomach|पेट|जलन|अॅसिडिटी|ਆਮਲ|ਪੇਟ|வயிறு|எரிச்சல்|অম্বল|পেট|కడుపు|మంట|પેટ|બળતરા|ಹೊಟ್ಟೆ|ಉರಿ/i.test(
    description,
  );

export const kioskIntakeSchema = z.strictObject({
  locale: patientLanguage,
  intent: z.enum(["intake", "urgent-help"]),
  consent: z.strictObject({
    care: z.boolean(),
    pharmacy: z.boolean(),
    remote: z.boolean(),
    research: z.boolean(),
    guardian: z.boolean(),
  }),
  verifiedIdentityId: z.uuid().optional(),
  complaint: z.enum(complaints).optional(),
  description: z.string().trim().max(600).default(""),
  answers: z.partialRecord(z.enum(sentinelQuestions), answer).default({}),
  interceptor: z
    .partialRecord(z.enum(interceptorQuestions), answer)
    .default({}),
  documentText: z.string().trim().max(4000).optional(),
});

export const checkInSchema = z
  .strictObject({
    recovery: z.enum(["better", "same", "worse"]),
    medication: z.enum(["taken", "missed", "not-applicable"]),
    distress: z.boolean(),
    systolic: z.number().int().min(50).max(300).optional(),
    diastolic: z.number().int().min(25).max(230).optional(),
    pulse: z.number().int().min(25).max(250).optional(),
    spo2: z.number().int().min(40).max(100).optional(),
    glucose: z.number().int().min(20).max(700).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(
    ({ systolic, diastolic }) =>
      systolic === undefined || diastolic === undefined || systolic > diastolic,
    { message: "Check the blood pressure values" },
  );
