# Sorgenti di Tavolo Poker

Il sito pubblicato è il file `index.html` nella cartella principale, costruito a partire da questi file.

| File | Contenuto |
|---|---|
| `engine.js` | Valutatore delle mani e simulazione Monte Carlo delle probabilità |
| `advice.js` | Consigli pre-flop e post-flop, classifica delle 169 mani |
| `dealer.js` | Logica del dealer: bui, rotazione del mazziere, piatti laterali, eliminazioni, timer |
| `app.js` | Interfaccia: Tavolo, Piatto, Classifica, Impostazioni |
| `calc.js` | Calcolatore e modalità torneo (all-in o fold) |
| `styles.css`, `body.html` | Grafica e struttura della pagina |
| `preflop.json` | Probabilità pre-flop: 169 mani × 1–9 avversari |
| `matrix.json` | Matrice delle probabilità 169 × 169 tra mani |
| `nash.json` | Range all-in/fold per 2–10 giocatori e 2–20 grandi bui (generati con `gen_nash.js`) |
| `test_dealer.js` | Test della logica del dealer (`node test_dealer.js`) |
| `sistema-link.js` | Collegamento al Sistema Jev: attivo solo quando l'app è aperta dal server sul portatile (http), spento su GitHub Pages |
| `test_sistema.js` | Banco di prova app + Sistema Jev: tornei completi con il server acceso (`node test_sistema.js 10`) |

**Per ricostruire `index.html`:**

1. Metti questi file in `src/`.
2. Metti `build.js` nella cartella sopra.
3. Esegui `node build.js`: il risultato finisce in `dist/`.
