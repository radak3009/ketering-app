## Rešenje: Zamena URL-a na tabletima

**Uzrok problema (potvrđeno):**
- Tableti su koristili **preview URL** (`id-preview--*.lovable.app`), koji je Lovable-ov razvojni link i zahteva login na Lovable nalog (ne na vašu aplikaciju).
- Vaše kiosk rute (`/kiosk/pickup`, `/kiosk/kitchen`) su već javne u kodu — nalaze se van `AuthProvider`-a i autentifikuju se isključivo preko `?t=TOKEN` query parametra koji edge funkcije proveravaju (`KIOSK_TOKEN_EMPLOYEE` / `KIOSK_TOKEN_KITCHEN`).
- Provereno: published verzija (`ketering-app.lovable.app`) je već postavljena kao **public** — dostupna svima sa linkom, bez ikakvog Lovable login-a.

**Zaključak:** Nikakve izmene koda nisu potrebne. Problem se rešava samo zamenom URL-a u Fully Kiosk Browser-u na tabletima.

---

## Koraci za vas (na svakom tabletu)

1. Otvorite **Fully Kiosk Browser → Settings → Web Content → Start URL**.
2. Zamenite trenutni preview URL jednim od ovih:

   **Kiosk za preuzimanje (zaposleni):**
   ```
   https://ketering-app.lovable.app/kiosk/pickup?t=KIOSK_TOKEN_EMPLOYEE
   ```

   **Kiosk za kuhinju:**
   ```
   https://ketering-app.lovable.app/kiosk/kitchen?t=KIOSK_TOKEN_KITCHEN
   ```

   (Zamenite `KIOSK_TOKEN_EMPLOYEE` / `KIOSK_TOKEN_KITCHEN` stvarnim vrednostima koje su već postavljene u Supabase secrets.)

3. **Settings → Advanced Web Settings → Clear Cache & Cookies** (jednom, da bi se obrisala stara preview sesija).
4. **Settings → Web Auto Reload** isključite ako je uključeno na agresivnu vrednost.
5. Restartujte Fully Kiosk (ili tablet).

## Preporučena dodatna podešavanja Fully Kiosk-a (ne zahteva izmene koda)

- **Kiosk Mode → Enable Kiosk Mode: ON** — blokira izlazak iz aplikacije.
- **Universal Launcher → Disable Status Bar / Disable Home Button: ON** — sprečava Android sistemske overlay-e (uključujući Google promptove).
- **Power Settings → Keep Screen On: ON**.
- **Internet Connection → Reload on Network Reconnect: ON**.
- (Opciono) Uklonite Google nalog sa tableta: **Android Settings → Accounts → Remove Google account**. Ovo dodatno eliminiše sistemske Google promptove.

## Zašto je preview URL tražio login

Preview linkovi (`id-preview--*.lovable.app`) su privatni Lovable razvojni linkovi — Lovable platforma pred njima postavlja autentifikacioni gateway koji proverava da li ste član workspace-a. To NIJE imalo veze sa vašom aplikacijom niti sa Google Sign-In-om. Published URL nema taj gateway.

## Šta NE treba raditi

- Ne pravimo `/kiosk` landing stranicu.
- Ne pravimo Capacitor APK.
- Ne menjamo kiosk rute, manifest, niti edge funkcije.
- Ne menjamo `vite.config.ts`.

## Verifikacija (nakon vaše izmene URL-a)

Na svakom tabletu, nakon promene Start URL-a u Fully Kiosk-u, kiosk treba da se otvori **bez ikakvog login prompta** i odmah prikaže polje za unos kartice (pickup) ili red kuhinje (kitchen).
