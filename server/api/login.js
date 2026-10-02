import { Router } from "express";
import { supabase } from "../supabaseClient.js";

const router =Router();

router.post("/", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({error: "Email and password are required"});
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if(error){
        return res.status(400).json({error: error.message});
    }
    else{
        return res.status(200).json({message: "User logged in successfully", data});
    }
    } catch (err) {
        return res.status(500).json({error: "Internal server error"});
    }
});

export default router;
