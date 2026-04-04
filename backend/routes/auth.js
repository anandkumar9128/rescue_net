import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../db/supbase.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_temporary_key';

router.post('/google', async (req, res) => {
    try {
        const { token, role } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: "Google token is required" });
        }

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // Check if user exists in Supabase
        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
             // PGRST116 means zero rows found, which is expected for new users.
            return res.status(500).json({ error: error.message });
        }

        let isNewUser = false;
        
        // If user doesn't exist, this is a registration
        if (!user) {
            if (!role) {
                return res.status(400).json({ error: "Role ('user', 'ngo', or 'volunteer') is required for registration." });
            }
            
            isNewUser = true;
            // Create the user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([
                    { email, name, picture, role }
                ])
                .select()
                .single();

            if (insertError) {
                 return res.status(500).json({ error: insertError.message });
            }
            user = newUser;
        }

        // Generate our own JWT for session management
        const sessionToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Authentication successful",
            token: sessionToken,
            user,
            isNewUser
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ error: "Invalid Google token or Auth error" });
    }
});

export default router;
