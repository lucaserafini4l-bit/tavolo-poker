# Guida rapida: quando giocare, foldare o andare all-in

Basata sulle skill del progetto (Turner *Hyper-Turbo*, regole `rules.yaml`) e sulle tabelle Nash push/fold. Per un torneo tra amici da 2 a 10 giocatori.

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
| Giocatori che parlano dopo di te | Range (% mani) | Esempi minimi |
|---|---|---|
| 6+ (UTG con tavolo pieno) | ~11% | 77+, AJs+, AQo+, KQs |
| 5 | ~14% | 66+, ATs+, AJo+, KQ |
| 4 (HJ) | ~17% | 55+, A9s+, ATo+, KJs+, KQo |
| 3 (CO) | ~22% | 44+, A7s+, A9o+, KTs+, KJo+, QJs |
| 2 (BTN) | ~30% | tutte le coppie, A2s+, A7o+, K9s+, KTo+, QTs+, JTs |
| 1 (SB) | ~38% | qualsiasi asso, K8+, Q9+, J9s+, T9s |

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
| Hai | Nessuno ha puntato | Ti hanno puntato |
|---|---|---|
| Mano molto forte (doppia coppia+, top pair buon kicker) | Punta 2/3 piatto | Rilancia, o all-in se SPR ≤ 3 |
| Mano discreta (coppia media) | Punta 1/2 piatto se 1-2 avversari, se no check | Chiama se l'equity supera le pot odds |
| Progetto (colore 9 out, scala 8 out) | Semi-bluff 1/2 piatto contro 1 avversario | Chiama se le odds bastano (regola del 2-4: out × 4 al flop, × 2 al turn) |
| Niente | Check (non bluffare contro 3+ avversari) | Fold |

**SPR** = tue fiches ÷ piatto. Con SPR ≤ 3 e una buona coppia, sei impegnato: non foldare.

## 5. Cinque errori da evitare (Turner)
1. Limpare con stack corto.
2. Aspettare troppo: sotto 10 bb il tuo all-in fa sempre meno paura.
3. Chiamare all-in "per curiosità" con mani deboli.
4. Bluffare i giocatori che chiamano tutto.
5. Rallentare con mani forti: tra amici si paga, punta per valore.

## Consigliere interattivo
Apri `index.html` in questa cartella (o il link GitHub Pages): inserisci giocatori, posizione, big blind, fiches, piatto, quanto devi chiamare e le carte; ti dice FOLD/CHECK/CALL/RAISE/ALL-IN con il motivo.
