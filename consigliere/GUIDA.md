# Guida rapida: quando giocare, foldare o andare all-in

Basata sulle skill del progetto (Turner *Hyper-Turbo*, regole `rules.yaml`), sulle tabelle Nash push/fold e (novembre 2026) sulla logica di **Pluribus**, il bot di Brown & Sandholm (*Science*, 2019), validata nel nostro simulatore. Per un torneo tra amici da 2 a 10 giocatori.

## 1. Il numero che conta: quanti big blind (bb) hai
**bb = le tue fiches ÷ big blind.** Ricalcolalo a ogni livello.

| Stack | Modalità | Regola |
|---|---|---|
| > 25 bb | Gioco normale | Apri a 2,5 bb con mani buone, vedi flop, gioca postflop |
| 15-25 bb | Gioco ristretto | Apri a 2,2 bb; contro un rilancio: all-in con le mani forti o fold |
| ≤ 15 bb | **Push/fold** | Mai limp, mai solo call: **all-in o fold** |
| ≤ 5 bb | Disperazione | All-in con quasi tutto appena puoi, soprattutto dal bottone/SB |

## 2. Preflop, nessuno ha rilanciato prima di te

### Con più di 15 bb: apri (rilancia) con
Tra amici conviene aprire **largo** (test Pluribus sotto, sezione 6).

| Giocatori che parlano dopo di te | Range (% mani) | Esempi minimi |
|---|---|---|
| 8 (UTG, tavolo da 10) | ~28% | 44+, A2s+, K6s+, Q8s+, JTs, A4o+, K9o+, QTo+ |
| 7 | ~31% | 44+, A2s+, K5s+, Q8s+, J9s+, A3o+, K8o+, Q9o+, JTo |
| 6 (UTG, tavolo da 9) | ~36% | 33+, A2s+, K3s+, Q7s+, J8s+, T9s, A2o+, K6o+, Q9o+, JTo |
| 5 | ~43% | 33+, A2s+, K2s+, Q4s+, J7s+, T8s+, A2o+, K4o+, Q7o+, J9o+ |
| 4 (HJ) | ~50% | 22+, A2s+, K2s+, Q2s+, J5s+, T7s+, 98s, A2o+, K2o+, Q5o+, J8o+, T9o |
| 3 (CO) e 1 (SB) | ~65% | 22+, ogni A/K/Q, J2s+, T3s+, 95s+, 86s+, 76s, J4o+, T6o+, 97o+ |
| 2 (BTN) | ~85% | quasi tutto: fold solo con 92o, 82o-83o, 72o-74o, 62o-64o, 52o-54o, 42o-43o, 32o e 72s, 62s, 52s, 42s, 43s, 32s |

Altrimenti **fold** (dalla BB: check gratis).
Con limper davanti: rilancia +1 bb per ogni limper; coppie piccole e suited possono entrare a poco (se costa <5% dello stack).

### Con 15 bb o meno: all-in con (tabelle Nash del progetto)
| bb | 1 dietro (SB) | 2 dietro (BTN) | 3+ dietro |
|---|---|---|---|
| 15 | 47% | 26% | ~19% e meno |
| 12 | 53% | 30% | ~22% |
| 10 | 58% | 33% | ~24% |
| 8 | 62% | 35% | ~25% |
| 5 | 71% | 40% | ~29% |
| 3 | 79% | 54% | ~39% |

Esempio reale dalla tabella: 10 bb dal bottone (2 dietro) → all-in con 22+, A2s+, A3o+, K6s+, KTo+, Q8s+, QTo+, J8s+, JTo, T7s+, T9o, 96s+, 86s+, 76s, 65s.

## 3. Preflop, qualcuno ha rilanciato
1. **QQ+, AK** → ri-rilancia (all-in se hai ≤ 30 bb).
2. **Pot odds**: equity richiesta = da chiamare ÷ (piatto + da chiamare). Chiama solo se la tua mano batte quel numero contro il range del rilanciatore.
3. Con ≤ 12 bb: **niente call**, o all-in o fold.
4. Se la chiamata è ≥ 40% delle tue fiches, sei impegnato: o tutto o niente.
5. Contro un all-in: i giocatori "normali" spingono ~25% delle mani; quelli "pazzi" anche il 45%. Contro i pazzi chiama più largo (A9, KJ, 66+).

## 4. Postflop (dopo il flop)
**Prima di tutto, leggi le sue azioni.** Come fa Pluribus, ogni azione dell'avversario cambia le mani che può avere:
- **Punta o rilancia** → di solito ha una mano forte o un progetto forte. Due puntate di fila restringono tantissimo (con un 3-bet preflop + due puntate resta ~5% delle mani).
- **Chiama** → mano media o progetto, raramente niente.
- **Check** → più spesso mani deboli: puoi puntare più leggero.

| Hai (equity contro il suo range stimato) | Nessuno ha puntato | Ti hanno puntato |
|---|---|---|
| ≥ 75% (mano molto forte) | Punta **2/3** piatto (all-in se SPR ≤ 1,5) | Rilancia a ~3× se equity ≥ 82%, all-in se SPR ≤ 3 |
| 55-75% (sei avanti) | Punta **1/3** contro 1-2 avversari, se hai rilanciato tu preflop | Chiama se equity ≥ pot odds + 2% |
| Progetto forte (colore, scala bilaterale) | Semi-bluff **1/2** contro 1 avversario, se hai rilanciato tu | Chiama con +5% di "odds implicite" (non al river) |
| Niente, ma hai rilanciato tu preflop | Al flop contro 1 avversario: c-bet piccola **1/3** | Fold |
| Niente | Check (mai bluff contro 3+ avversari) | Fold |

**SPR** = tue fiches ÷ piatto. Con SPR ≤ 3 e una buona coppia, sei impegnato: non foldare.
Senza rilancio preflop tuo non "donkare" (puntare per primo) con mani medie: nei test non ha dato vantaggi misurabili.

## 5. Cinque errori da evitare (Turner)
1. Limpare con stack corto.
2. Aspettare troppo: sotto 10 bb il tuo all-in fa sempre meno paura.
3. Chiamare all-in "per curiosità" con mani deboli.
4. Bluffare i giocatori che chiamano tutto.
5. Rallentare con mani forti: tra amici si paga, punta per valore.

## 6. Cosa abbiamo preso da Pluribus (e cosa no)
Test nel simulatore a 9 giocatori, vincitore unico, 1.000 tornei per riga (pareggio = 11,1%), percentuale di vittorie con riduzione della varianza alla AIVAT. Oltre al campo "amici" e al campo "duro" (LAG/TAG/maniac), Pluribus insegna a provare la strategia contro avversari che **foldano**, **chiamano** o **rilanciano** troppo, e a scegliere quella col **caso peggiore** migliore.

| Strategia | Amici | Duro | Foldano | Chiamano | Rilanciano | Caso peggiore |
|---|---|---|---|---|---|---|
| Manuale (apri 36% HJ) | 26,9% | 16,2% | 41,6% | 31,3% | 15,1% | 15,1% |
| Apri 50% HJ | 28,3% | 23,4% | 49,5% | 32,9% | 16,4% | 16,4% |
| **Apri 50% + range bayesiano (adottata)** | **31,2%** | 20,4% | 47,1% | **42,4%** | **23,2%** | **20,4%** |

Margine di errore ±1,9-2,7 punti. Adottato: aperture larghe e lettura delle azioni (range bayesiano) con puntate ⅓-⅔. Contro un tavolo molto aggressivo l'apertura larga da sola fa un po' meglio (23,4%), ma la nuova strategia ha il caso peggiore più alto (20,4% contro 16,4%).
Non adottato perché nei test non migliorava o peggiorava: strategie miste casuali (-2/-3 punti), limp dallo SB e donk bet (+1/+2, non significativo), strategia blind-vs-blind dal mini-solver CFR (-2/-3 punti contro questi avversari).

## Consigliere interattivo
Apri `index.html` in questa cartella (o il link GitHub Pages): inserisci giocatori, posizione, big blind, fiches, piatto, quanto devi chiamare e le carte; ti dice FOLD/CHECK/CALL/RAISE/ALL-IN con il motivo. Dopo il flop indica anche cosa ha fatto l'avversario (preflop, flop, turn, river): il consigliere restringe il suo range e ricalcola l'equity.
