import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getCurrentDateInSerbian(): string {
  const now = new Date();
  const days = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
  const months = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
  
  const dayName = days[now.getDay()];
  const day = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  
  return `${dayName}, ${day}. ${monthName} ${year}. (${hours}:${minutes})`;
}

function getDeadlineInfo(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = nedelja, 5 = petak
  const hours = now.getHours();
  
  if (dayOfWeek === 5 && hours < 15) {
    return "⚠️ Danas je petak pre 15h - zaposleni MOGU još uvek da poručuju obroke za narednu nedelju!";
  } else if (dayOfWeek === 5 && hours >= 15) {
    return "⚠️ Danas je petak posle 15h - rok za porudžbine za narednu nedelju je istekao.";
  } else if (dayOfWeek === 6 || dayOfWeek === 0) {
    return "⚠️ Danas je vikend - rok za porudžbine za narednu nedelju je istekao (petak 15h).";
  } else {
    return "✅ Zaposleni mogu poručivati obroke za narednu nedelju do petka u 15h.";
  }
}

const EMPLOYEE_SYSTEM_PROMPT = `Ti si pomoćni AI asistent za aplikaciju za naručivanje obroka. Odgovaraš zaposlenom korisniku.

DOSTUPNE FUNKCIONALNOSTI ZA ZAPOSLENOG:
1. **Naručivanje obroka**:
   - "Iduća nedelja" tab - porudžbine za narednu nedelju (do petka u 15h)
   - "Tekuća nedelja" tab - pregled trenutnih porudžbina
   - Klikom na "Poruči obrok" otvara se dijalog za izbor obroka
   - Odabir smene (prva, druga, treća)
   
2. **Feedback**:
   - "Feedback" tab za slanje povratnih informacija
   - Mogu da daju komentare o obrocima i usluzi
   
3. **Predlozi**:
   - U "Feedback" sekciji mogu predložiti nove obroke
   - Unose naziv, opis i dodatne napomene
   
4. **Profil**:
   - "Profil" tab za ažuriranje ličnih podataka
   - Mogu promeniti ime, telefon, datum rođenja
   - **Promena lozinke** - posebna sekcija za unos nove lozinke sa potvrdom (minimum 6 karaktera)
   - Email se prikazuje ali ne može se menjati
   
5. **NFC Preuzimanje**:
   - Obroci se preuzimaju NFC karticom

6. **Podešavanja izgleda**:
   - Dark/Light mode toggle u headeru (ikona sunca/meseca)
   - Tri opcije: Svetla tema, Tamna tema, Sistemska podešavanja
   - Menja izgled cele aplikacije

7. **AI Pomoćnik** (ovo si ti!):
   - Na mobilnom: ikona "AI" u donjoj navigaciji (peta ikona)
   - Na desktopu: ikona robota u headeru pored toggle-a za temu
   - Pruža pomoć za korišćenje aplikacije

NAVIGACIJA:
- Desktop: Header sa logom, AI pomoćnikom, dark mode toggle-om i dugmetom za odjavu
- Mobilni: Donja navigacija sa 5 tabova: Iduća nedelja, Tekuća nedelja, Feedback, Profil, AI

VAŽNA PRAVILA:
- Porudžbine za narednu nedelju mogu se praviti samo do petka u 15h
- Svaka porudžbina mora imati odabranu smenu
- Zaposleni mogu videti samo svoje porudžbine

KRITIČNO VAŽNO - JEZIK:
Odgovaraj ISKLJUČIVO na srpskom jeziku korišćenjem LATINICE. NIKADA ne koristi ćirilicu.
Svaki odgovor mora biti napisan latiničnim slovima.

Primeri:
✅ TAČNO: "Kliknite na dugme 'Poruči obrok' i odaberite datum."
✅ TAČNO: "Možete promeniti lozinku u Profil tabu, sekcija 'Promena lozinke'."
❌ NETAČNO: "Кликните на дугме 'Поручи оброк' и одаберите датум."
❌ NETAČNO: "Можете променити лозинку у Профил табу."

Budi jasan i koncizan. Koristi numerisane korake i emoji za važne napomene (⚠️, 💡, ✅).`;

const ADMIN_SYSTEM_PROMPT = `Ti si pomoćni AI asistent za aplikaciju za naručivanje obroka. Odgovaraš administratoru.

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
   
5. **Feedback i predlozi**:
   - Pregled feedback-a od zaposlenih
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, role } = await req.json();
    
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

    // Get current date and time context
    const currentDate = getCurrentDateInSerbian();
    const deadlineInfo = getDeadlineInfo();
    const dateContext = `TRENUTNI DATUM I VREME: ${currentDate}\n${deadlineInfo}\n\n`;
    
    // Select system prompt based on role and prepend date context
    const basePrompt = role === 'admin' ? ADMIN_SYSTEM_PROMPT : EMPLOYEE_SYSTEM_PROMPT;
    const systemPrompt = dateContext + basePrompt;

    console.log(`Processing chat request for ${role} with ${messages.length} messages at ${currentDate}`);

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
        return new Response(
          JSON.stringify({ error: 'Previše zahteva, molimo pokušajte kasnije.' }), 
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Potrebno je dodati kredite u Lovable AI workspace.' }), 
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
