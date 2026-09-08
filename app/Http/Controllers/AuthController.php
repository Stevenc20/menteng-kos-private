<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    /**
     * Redirect the user to the Google authentication page.
     */
    public function redirectToGoogle()
    {
        return Socialite::driver('google')->redirect();
    }

    /**
     * Obtain the user information from Google.
     */
    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
            
            // Peraturan Bisnis: Hanya tenant yang sudah diundang (email terdaftar) yang bisa login.
            $user = User::where('email', $googleUser->getEmail())->first();

            if (!$user) {
                // Return access denied / error page via Inertia
                return redirect('/login')->with('error', 'Your account has not been registered by the administrator.');
            }

            // Update google_id and mark email as verified if not already
            if (!$user->google_id) {
                $user->update([
                    'google_id' => $googleUser->getId(),
                    'email_verified_at' => now(),
                ]);
            }

            // Login user
            Auth::login($user);

            // Redirect based on role
            if ($user->role === 'ADMIN') {
                return redirect()->intended('/admin/dashboard');
            }

            return redirect()->intended('/tenant/dashboard');

        } catch (\Exception $e) {
            return redirect('/login')->with('error', 'Something went wrong during Google Login. Please try again.');
        }
    }

    /**
     * Log the user out of the application.
     */
    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
