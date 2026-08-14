import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/usage";
import { createCheckoutSession } from "@/lib/stripe-rest";
export const runtime="nodejs";
export async function POST(request:Request){try{const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});const {plan}=await request.json();const priceId=plan==="PREMIUM"?process.env.STRIPE_PRICE_PREMIUM:plan==="PRO"?process.env.STRIPE_PRICE_PRO:null;if(!priceId)return NextResponse.json({error:"Stripe price ID is not configured for this plan."},{status:400});const origin=request.headers.get("origin")||process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000";const session=await createCheckoutSession({priceId,email:user.email,userId:user.id,plan,origin});return NextResponse.json({url:session.url});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Checkout failed."},{status:500});}}
