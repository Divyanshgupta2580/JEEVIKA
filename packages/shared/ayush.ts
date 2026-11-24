import { z } from "zod";

export const dashavidha = {
  prakriti: "Prakriti · Constitution",
  vikriti: "Vikriti · Current imbalance",
  sara: "Sara · Tissue quality",
  samhanana: "Samhanana · Body build",
  pramana: "Pramana · Measurements",
  satmya: "Satmya · Adaptability",
  satva: "Satva · Mental constitution",
  aharashakti: "Aharashakti · Digestive capacity",
  vyayamashakti: "Vyayamashakti · Exercise capacity",
  vaya: "Vaya · Life stage",
} as const;

const note = z.string().trim().max(1200);
export const ayushNoteSchema = z.strictObject({
  examination: z.record(
    z.enum(
      Object.keys(dashavidha) as [
        keyof typeof dashavidha,
        ...(keyof typeof dashavidha)[],
      ],
    ),
    note,
  ),
  dosha: z.object({
    vata: z.number().int().min(0).max(100).nullable(),
    pitta: z.number().int().min(0).max(100).nullable(),
    kapha: z.number().int().min(0).max(100).nullable(),
  }),
  agni: z.enum(["", "Samagni", "Vishamagni", "Tikshnagni", "Mandagni"]),
  namasteCode: z.string().trim().max(80),
  tm2Code: z.string().trim().max(80),
  concurrentMedicines: z.array(z.string().trim().min(1).max(160)).max(30),
  formulations: z
    .array(
      z.strictObject({
        name: z.string().trim().min(1).max(160),
        dose: z.string().trim().max(100),
        anupana: z.string().trim().max(160),
        duration: z.string().trim().max(100),
      }),
    )
    .max(30),
  plan: z.string().trim().max(4000),
});

export type AyushNote = z.infer<typeof ayushNoteSchema>;
