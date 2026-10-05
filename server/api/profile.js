import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/profile/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ message: 'Profile fetched successfully', data });
});

// PUT /api/profile/update
router.put("/update", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid session token" });
  }

  const { full_name, username, bio, avatar_url } = req.body;

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name,
      username,
      bio,
      avatar_url,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ message: "Profile updated successfully", data });
});

export default router;