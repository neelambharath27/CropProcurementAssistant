import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  mobile: z.string().trim().regex(/^[0-9]{10}$/),
  email: z.string().trim().email().optional().or(z.literal("")),
  location: z.string().trim().min(2).max(120),
  district: z.string().trim().min(2).max(80),
  village: z.string().trim().min(2).max(80),
  preferredLanguage: z.enum(["en","te","hi"])
});

export const cropSchema = z.object({
  cropName: z.string().trim().min(2).max(60),
  cropVariety: z.string().trim().min(2).max(80),
  quantityKg: z.number().positive().max(1000000),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedProcurementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().trim().min(2).max(120)
}).superRefine((v,ctx)=>{
  if(v.expectedProcurementDate < v.harvestDate)
    ctx.addIssue({code:"custom",path:["expectedProcurementDate"],message:"Expected procurement date cannot be before harvest date."});
});
