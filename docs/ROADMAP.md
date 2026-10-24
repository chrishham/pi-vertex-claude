# pi-vertex-claude — Roadmap & εκκρεμότητες

Extension για το pi-agent που καταχωρεί μοντέλα Claude (Vertex AI, Azure Foundry) και Azure OpenAI με επιμελημένη λίστα μοντέλων. Λεπτομέρειες: `README.md`.

## Φάσεις

| Φάση | Τι | Κατάσταση |
|---|---|---|
| 1 | Provider `vertex-claude` (Vertex AI, ADC) μέσω `streamAnthropic` | ✅ |
| 2 | Providers `foundry-claude` και `azure-openai-responses`, curated model list | ✅ |
| 3 | README για multi-provider setup | ✅ |

## Αποφάσεις (να μην ξαναρωτηθούν)

- Λεπτός provider: delegation στο built-in `streamAnthropic` με injected client (`options.client`), χωρίς custom SSE parsing.
- Μόνο μοντέλα που είναι πραγματικά deployed (curated λίστα, όχι ο default κατάλογος των 42 μοντέλων).
- Auth: ADC για Vertex, API keys μέσω env variables για Foundry/Azure OpenAI.

## Εκκρεμότητες χρήστη

—

## Εκκρεμότητες Claude

- [ ] Το `package-lock.json` είναι untracked: απόφαση αν γίνεται commit ή μπαίνει στο `.gitignore` (εκτίμηση).
- [ ] Δεν υπάρχουν tests ούτε build/lint scripts (εκτίμηση από το repo).

## Ιδέες / μελλοντικά

- Ανανέωση λιστών μοντέλων όταν βγαίνουν νέες εκδόσεις (εκτίμηση).

## Ιστορικό

- 2026-06-05: αρχικό extension για Vertex AI Claude· διορθώσεις import path / dummy apiKey
- 2026-06-05: προσθήκη Foundry και Azure OpenAI providers, curate model list
- 2026-06-05: README για multi-provider setup
- 2026-10-24: ROADMAP δημιουργήθηκε από ανασκόπηση repo/memory
