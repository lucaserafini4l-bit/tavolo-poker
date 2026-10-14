## Come si usa al tavolo

Il dispositivo del **dealer** (un tablet o un telefono al centro del tavolo) gestisce timer, bui, piatto e classifica. Ogni giocatore può usare la sezione **Carte** sul proprio telefono per le probabilità.

Ogni telefono ha la sua copia dei dati: timer e frecce non si sincronizzano tra dispositivi diversi.

| Sezione | A cosa serve |
|---|---|
| **Tavolo** | <ul><li>Timer del livello: durata da 5 a 15 minuti, avvio e pausa, livello precedente e successivo.</li><li>Tavolo con le frecce **SB** (piccolo buio) e **BB** (grande buio) con l'importo da mettere, e il bottone **D** del mazziere.</li><li>Per ogni giocatore: fiches, posizione e "numero magico" (fiches ÷ grande buio).</li><li>**Mano successiva** sposta il mazziere e i bui di un posto, saltando gli eliminati.</li></ul> |
| **Piatto** | <ul><li>I bui entrano da soli nel piatto.</li><li>Per ogni giocatore puoi registrare Fold, Check/Chiama, Rilancia o All-in.</li><li>A fine mano scegli il vincitore: l'app divide i pari merito, crea i piatti laterali quando qualcuno è all-in con meno fiches e segna gli eliminati.</li><li>**Annulla** torna indietro di un'azione.</li></ul> |
| **Classifica** | <ul><li>Montepremi (iscrizione × giocatori) e quote per posto.</li><li>Classifica in diretta per fiches, con gli eliminati in ordine.</li><li>Vincitore finale.</li></ul> |
| **Carte** | <ul><li>Calcolatore di probabilità con le tue carte e il board.</li><li>In **modalità torneo** inserisci le tue fiches e il grande buio. Con meno di 20 grandi bui ti dice **ALL-IN**, **FOLD** o **CHIAMA** in base alla posizione, e mostra il semaforo della mano.</li><li>Sul dispositivo del dealer, scegliendo "Io sono" il calcolatore prende da solo fiches, posizione e bui dal tavolo.</li></ul> |
| **Impostazioni** | <ul><li>Nomi e ordine dei giocatori (da 2 a 10), fiches iniziali.</li><li>Livelli dei bui. Pre-impostati: 20/40 → 40/80 → 60/120 → 80/160 → 100/200.</li><li>Iscrizione e percentuali dei premi.</li><li>Suono e vibrazione degli avvisi.</li><li>Gestione automatica di fiches e piatto: puoi spegnerla se volete usare solo timer e frecce.</li></ul> |

**Avvisi del timer:** a 1 minuto dalla fine del livello e al cambio livello compaiono un banner, un suono e una vibrazione. Il suono funziona dopo aver premuto almeno una volta "Avvia timer". I nuovi bui valgono **dalla mano successiva**.

**Controllo fiches:** nella sezione Tavolo, "Controllo fiches" somma le fiches di tutti più il piatto. Deve sempre essere uguale a giocatori × fiches iniziali: se compare in rosso, qualche importo è stato inserito male.

---

## Come sono calcolati i consigli

- **Probabilità pre-flop:** tabella di 169 mani × 1–9 avversari, con 60.000 simulazioni per cella.
- **Dopo il flop:** simulazione Monte Carlo in tempo reale.
- **All-in o fold:** range di equilibrio calcolati per 2–10 giocatori e da 2 a 20 grandi bui, su una matrice di 169 × 169 confronti tra mani (12.000 simulazioni per coppia).
  - Verifica sui valori noti: in testa a testa con 10 grandi bui, all-in col 58% delle mani da piccolo buio e chiamata col 37% da grande buio.

I consigli presuppongono avversari con mani casuali e chi vince prende tutto. Usali come guida, non come garanzia.

Tutto il codice gira nel browser: nessun dato viene inviato a server esterni.
