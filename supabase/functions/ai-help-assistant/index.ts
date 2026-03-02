import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getCurrentDateInfo(language: string): { dateStr: string; deadlineInfo: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hours = now.getHours();
  
  if (language === 'en') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[dayOfWeek];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const dateStr = `${dayName}, ${monthName} ${day}, ${year} (${hours}:${minutes})`;
    
    let deadlineInfo: string;
    if (dayOfWeek === 5 && hours < 17) {
      deadlineInfo = "⚠️ Today is Friday before 5 PM - employees CAN still order meals for next week!";
    } else if (dayOfWeek === 5 && hours >= 17) {
      deadlineInfo = "⚠️ Today is Friday after 5 PM - the deadline for next week's orders has passed.";
    } else if (dayOfWeek === 6 || dayOfWeek === 0) {
      deadlineInfo = "⚠️ It's the weekend - the deadline for next week's orders has passed (Friday 5 PM).";
    } else {
      deadlineInfo = "✅ Employees can order meals for next week until Friday at 5 PM.";
    }
    
    return { dateStr, deadlineInfo };
  } else {
    const days = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
    const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
    
    const dayName = days[dayOfWeek];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const dateStr = `${dayName}, ${day}. ${monthName} ${year}. (${hours}:${minutes})`;
    
    let deadlineInfo: string;
    if (dayOfWeek === 5 && hours < 17) {
      deadlineInfo = "⚠️ Danas je petak pre 17h - zaposleni MOGU još uvek da poručuju obroke za narednu nedelju!";
    } else if (dayOfWeek === 5 && hours >= 17) {
      deadlineInfo = "⚠️ Danas je petak posle 17h - rok za porudžbine za narednu nedelju je istekao.";
    } else if (dayOfWeek === 6 || dayOfWeek === 0) {
      deadlineInfo = "⚠️ Danas je vikend - rok za porudžbine za narednu nedelju je istekao (petak 17h).";
    } else {
      deadlineInfo = "✅ Zaposleni mogu poručivati obroke za narednu nedelju do petka u 17h.";
    }
    
    return { dateStr, deadlineInfo };
  }
}

function getEmployeePrompt(language: string): string {
  if (language === 'en') {
    return `You are a helpful AI assistant for a meal ordering application. You are responding to an employee user.

AVAILABLE FEATURES FOR EMPLOYEES:
1. **Ordering meals**:
   - "Next week" tab - orders for next week (until Friday at 5 PM)
   - "Current week" tab - view current orders (read-only)
   - Click "Order meal" to open the meal selection dialog
   - Select day, shift (first, second, third), and meal
   - Progress indicator shows how many days you've ordered out of available menu days
   - ⚠️ You MUST have your employee ID and organization set in your profile before you can order meals. If the "Order meal" button is grayed out, go to Profile and complete your setup first.
   
2. **First-time setup (Onboarding)**:
   - When you first log in, you MUST set your employee ID number and select your organizational unit (Tag/Organization)
   - Until these are set, you cannot access other features - only the Profile tab is available
   - Employee ID must be a unique numeric value (max 10 digits) provided by your administrator
   - Organization selection shows available organizational units configured by admin
   - Once set, ID becomes read-only (contact admin to change)
   
3. **Feedback**:
   - "Feedback" tab for sending feedback about meals and service
   - Can comment on food quality, service speed, staff, etc.
   
4. **Suggestions**:
   - In the "Feedback" section, "Suggestions" tab to suggest new meals
   - Enter meal name, description, and additional notes
   
5. **Profile**:
   - "Profile" tab to update personal information
   - Can change name, phone, date of birth
   - **Change password** - separate section for entering new password with confirmation (minimum 6 characters)
   - Email is displayed but cannot be changed
   - Employee ID is read-only after initial setup
   - Notification preferences: enable/disable email and push notifications for order reminders
   
6. **NFC Pickup**:
   - Meals are picked up using NFC card at the kiosk
   - Pickup status visible on current week orders (picked up / not picked up)

7. **Appearance settings**:
   - Dark/Light mode toggle in header (sun/moon icon)
   - Three options: Light theme, Dark theme, System settings

8. **Language toggle**:
   - Flag icons in header to switch between Serbian and English

9. **AI Assistant** (that's you!):
   - On mobile: "AI" icon in bottom navigation (fifth icon)
   - On desktop: robot icon in header next to theme toggle

NAVIGATION:
- Desktop: Header with logo, language toggle, AI assistant, dark mode toggle, user info (ID + name), and logout button
- Mobile: Bottom navigation with 5 tabs: Next week, Current week, Feedback, Profile, AI

IMPORTANT RULES:
- Orders for next week can only be made until Friday at 5 PM
- Each order must have a selected shift
- Employees can only see their own orders
- You must complete profile setup (ID + organization) before ordering
- Some meals may only be visible to users with specific organization tags

Be clear and concise. Use numbered steps and emoji for important notes (⚠️, 💡, ✅).`;
  }
  
  return `Ti si pomoćni AI asistent za aplikaciju za naručivanje obroka. Odgovaraš zaposlenom korisniku.

DOSTUPNE FUNKCIONALNOSTI ZA ZAPOSLENOG:
1. **Naručivanje obroka**:
   - "Iduća nedelja" tab - porudžbine za narednu nedelju (do petka u 17h)
   - "Tekuća nedelja" tab - pregled trenutnih porudžbina (samo čitanje)
   - Klikom na "Poruči obrok" otvara se dijalog za izbor obroka
   - Odabir dana, smene (prva, druga, treća) i obroka
   - Indikator napretka prikazuje koliko ste dana poručili od ukupno dostupnih dana
   - ⚠️ MORATE imati unet ID zaposlenog i organizaciju u profilu pre nego što možete poručivati obroke. Ako je dugme "Poruči obrok" zatamnjeno, idite na Profil i dopunite podatke.
   
2. **Prva prijava (Onboarding)**:
   - Pri prvoj prijavi MORATE uneti svoj ID zaposlenog i odabrati organizacionu jedinicu (Tag/Organizacija)
   - Dok ovi podaci nisu uneti, nemate pristup ostalim funkcionalnostima - dostupan je samo tab Profil
   - ID zaposlenog mora biti jedinstven, numerički (max 10 cifara), dodeljen od administratora
   - Odabir organizacije prikazuje dostupne organizacione jedinice koje je konfigurisao admin
   - Nakon postavljanja, ID postaje zaključan (za promenu kontaktirajte admina)
   
3. **Utisci i predlozi**:
   - "Utisci i predlozi" tab za slanje povratnih informacija
   - Mogu da daju komentare o kvalitetu hrane, brzini usluge, osoblju itd.
   
4. **Predlozi obroka**:
   - U "Utisci i predlozi" sekciji, tab "Predlozi" za predlaganje novih obroka
   - Unose naziv obroka, opis i dodatne napomene
   
5. **Profil**:
   - "Profil" tab za ažuriranje ličnih podataka
   - Mogu promeniti ime, telefon, datum rođenja
   - **Promena lozinke** - posebna sekcija za unos nove lozinke sa potvrdom (minimum 6 karaktera)
   - Email se prikazuje ali ne može se menjati
   - ID zaposlenog je zaključan nakon inicijalnog postavljanja
   - Podešavanja obaveštenja: uključivanje/isključivanje email i push obaveštenja za podsetnike
   
6. **NFC Preuzimanje**:
   - Obroci se preuzimaju NFC karticom na kiosku
   - Status preuzimanja vidljiv na porudžbinama tekuće nedelje (preuzeto / nije preuzeto)

7. **Podešavanja izgleda**:
   - Dark/Light mode toggle u headeru (ikona sunca/meseca)
   - Tri opcije: Svetla tema, Tamna tema, Sistemska podešavanja

8. **Izbor jezika**:
   - Ikonice zastava u headeru za prebacivanje između srpskog i engleskog

9. **AI Pomoćnik** (ovo si ti!):
   - Na mobilnom: ikona "AI" u donjoj navigaciji (peta ikona)
   - Na desktopu: ikona robota u headeru pored toggle-a za temu

NAVIGACIJA:
- Desktop: Header sa logom, izborom jezika, AI pomoćnikom, dark mode toggle-om, info o korisniku (ID + ime) i dugmetom za odjavu
- Mobilni: Donja navigacija sa 5 tabova: Iduća nedelja, Tekuća nedelja, Utisci, Profil, AI

VAŽNA PRAVILA:
- Porudžbine za narednu nedelju mogu se praviti samo do petka u 17h
- Svaka porudžbina mora imati odabranu smenu
- Zaposleni mogu videti samo svoje porudžbine
- Morate dopuniti profil (ID + organizacija) pre nego što možete poručivati
- Neki obroci mogu biti vidljivi samo korisnicima sa određenim organizacionim tagom

KRITIČNO VAŽNO - JEZIK:
Odgovaraj ISKLJUČIVO na srpskom jeziku korišćenjem LATINICE. NIKADA ne koristi ćirilicu.
Svaki odgovor mora biti napisan latiničnim slovima.

Primeri:
✅ TAČNO: "Kliknite na dugme 'Poruči obrok' i odaberite datum."
✅ TAČNO: "Možete promeniti lozinku u Profil tabu, sekcija 'Promena lozinke'."
❌ NETAČNO: "Кликните на дугме 'Поручи оброк' и одаберите датум."
❌ NETAČNO: "Можете променити лозинку у Профил табу."

Budi jasan i koncizan. Koristi numerisane korake i emoji za važne napomene (⚠️, 💡, ✅).`;
}

function getAdminPrompt(language: string): string {
  if (language === 'en') {
    return `You are a helpful AI assistant for a meal ordering application. You are responding to an administrator.

AVAILABLE FEATURES FOR ADMIN:
1. **Dashboard with metrics**:
   - Display of key statistics (total orders, number of users, revenue)
   - Date filter (defaults to next week)
   - Pivot table for consolidated view by meal and day
   
2. **Users**:
   - Creating new users
   - Sending magic link invitations
   - Deleting users (complete with all data)
   - Viewing all users and their profiles
   
3. **Meals**:
   - Adding new meals with images
   - Categories, prices, nutritional information
   - Allergens and status (active/inactive)
   - Image upload to "Slike obroka" bucket
   - Shift assignment (first, second, third)
   
4. **Menus**:
   - Creating weekly menus
   - Assigning meals by day
   - Activating/deactivating menus
   
5. **Feedback and suggestions**:
   - Viewing feedback from employees
   - Marking as processed
   - Viewing suggestions for new meals
   
6. **Pivot table**:
   - Consolidated view of orders by meal and day
   - For meal preparation and planning
   - Filter by delivery date

IMPORTANT NOTES:
- Dashboard metrics filter by delivery_date (delivery date), not order_date
- Deleting users calls Edge Function 'delete-user' with Service Role Key
- RLS policies allow admins full access to all data
- Pivot table is key for meal production planning

Be clear and concise. Use numbered steps and emoji for important notes (⚠️, 💡, ✅).`;
  }
  
  return `Ti si pomoćni AI asistent za aplikaciju za naručivanje obroka. Odgovaraš administratoru.

DOSTUPNE FUNKCIONALNOSTI ZA ADMINA:
1. **Dashboard sa metrikama**:
   - Prikaz ključnih statistika (ukupne porudžbine, broj korisnika, prihod)
   - Filter po datumu (podrazumevano naredna nedelja)
   - Pivot tabela za konsolidovan pregled po obroku i danu
   
2. **Korisnici**:
   - Kreiranje novih korisnika
   - Slanje magic link pozivnica
   - Brisanje korisnika (kompletno sa svim podacima)
   - Pregled svih korisnika i njihovih profila
   
3. **Obroci**:
   - Dodavanje novih obroka sa slikama
   - Kategorije, cene, nutritivne informacije
   - Alergeni i status (aktivan/neaktivan)
   - Upload slika u "Slike obroka" bucket
   - Dodela smena (prva, druga, treća)
   
4. **Jelovnici**:
   - Kreiranje nedeljnih jelovnika
   - Dodeljivanje obroka po danima
   - Aktiviranje/deaktiviranje jelovnika
   
5. **Utisci i predlozi**:
   - Pregled utisaka od zaposlenih
   - Označavanje kao obrađeno
   - Pregled predloga za nove obroke
   
6. **Pivot tabela**:
   - Konsolidovan prikaz porudžbina po obroku i danu
   - Za pripremu i planiranje obroka
   - Filter po datumu isporuke

VAŽNE NAPOMENE:
- Dashboard metriku filtriraju po delivery_date (datum isporuke), ne order_date
- Brisanje korisnika poziva Edge Function 'delete-user' sa Service Role Key
- RLS politike omogućavaju adminima pun pristup svim podacima
- Pivot tabela je ključna za planiranje proizvodnje obroka

KRITIČNO VAŽNO - JEZIK:
Odgovaraj ISKLJUČIVO na srpskom jeziku korišćenjem LATINICE. NIKADA ne koristi ćirilicu.
Svaki odgovor mora biti napisan latiničnim slovima.

Primeri:
✅ TAČNO: "Idite na tab 'Korisnici' i kliknite 'Dodaj korisnika'."
✅ TAČNO: "Pivot tabela prikazuje konsolidovane porudžbine."
❌ NETAČNO: "Идите на таб 'Корисници' и кликните 'Додај корисника'."
❌ NETAČNO: "Пивот табела приказује консолидоване поруџбине."

Budi jasan i koncizan. Koristi numerisane korake i emoji za važne napomene (⚠️, 💡, ✅).`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, role, language = 'sr' } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    if (!role || !['admin', 'employee'].includes(role)) {
      throw new Error('Valid role (admin or employee) is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get current date and deadline info in the appropriate language
    const { dateStr, deadlineInfo } = getCurrentDateInfo(language);
    const dateContextLabel = language === 'en' ? 'CURRENT DATE AND TIME' : 'TRENUTNI DATUM I VREME';
    const dateContext = `${dateContextLabel}: ${dateStr}\n${deadlineInfo}\n\n`;
    
    // Select system prompt based on role and language
    const basePrompt = role === 'admin' ? getAdminPrompt(language) : getEmployeePrompt(language);
    const systemPrompt = dateContext + basePrompt;

    console.log(`Processing chat request for ${role} in ${language} with ${messages.length} messages at ${dateStr}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        const errorMsg = language === 'en' 
          ? 'Too many requests, please try again later.' 
          : 'Previše zahteva, molimo pokušajte kasnije.';
        return new Response(
          JSON.stringify({ error: errorMsg }), 
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (response.status === 402) {
        const errorMsg = language === 'en' 
          ? 'Credits needed for AI functionality.' 
          : 'Potrebno je dodati kredite za AI funkcionalnost.';
        return new Response(
          JSON.stringify({ error: errorMsg }), 
          {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in ai-help-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
