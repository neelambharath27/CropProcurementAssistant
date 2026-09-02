import test from "node:test";
import assert from "node:assert/strict";
import {cropSchema,profileSchema} from "../src/validation.js";

test("crop requires positive quantity",()=>{
  const r=cropSchema.safeParse({cropName:"Paddy",cropVariety:"BPT",quantityKg:0,harvestDate:"2026-08-25",expectedProcurementDate:"2026-08-30",location:"Village A"});
  assert.equal(r.success,false);
});
test("procurement date cannot precede harvest",()=>{
  const r=cropSchema.safeParse({cropName:"Paddy",cropVariety:"BPT",quantityKg:850,harvestDate:"2026-08-25",expectedProcurementDate:"2026-08-20",location:"Village A"});
  assert.equal(r.success,false);
});
test("profile supports all three languages",()=>{
  for(const preferredLanguage of ["en","te","hi"]){
    const r=profileSchema.safeParse({name:"Demo Farmer",mobile:"9000000000",email:"demo@example.com",location:"Village A",district:"District",village:"Village A",preferredLanguage});
    assert.equal(r.success,true);
  }
});
