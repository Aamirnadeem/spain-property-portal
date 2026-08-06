# Comparison scoring specification (phase4a.v1)

Status: Implemented in `@spain/domain` `comparison-scoring.ts`

## Version

`SCORE_MODEL_VERSION = 'phase4a.v1'`

## Formula

For weights \(w_i \in \{0,\ldots,10\}\) and available fact scores \(f_i \in [0,1]\):

\[
\mathrm{score} = \mathrm{round}\left(100 \times \frac{\sum_i w_i f_i}{\sum_i w_i}\right)
\]

only over criteria with **available** facts and \(w_i > 0\).

If \(\sum w_i = 0\) over available criteria → `score: null`, `reason: 'no_scorable_inputs'`.

Missing criteria are listed in `missing[]` and **excluded** from the denominator (never treated as average).

## Weight keys

`price`, `location`, `commute`, `quiet_surroundings`, `coastal_access`, `outdoor_space`, `size`, `condition`, `energy_efficiency`, `accessibility`, `investment_potential`

Validation: integers 0–10; unknown keys / negatives / non-integers rejected.

## Fact mappings

| Key                  | Available when                       | Fact score                                      |
| -------------------- | ------------------------------------ | ----------------------------------------------- |
| price                | price present in cohort              | inverse normalize within set (cheaper → higher) |
| size                 | built or usable area                 | ascending normalize within set                  |
| commute              | commute_min                          | inverse normalize within set                    |
| location             | area label non-empty                 | 1                                               |
| coastal_access       | environment or beach proximity known | 1 if coastal/beach else 0                       |
| quiet_surroundings   | environment_type present             | hillside 1 / coastal 0.6 / city_center 0.4      |
| outdoor_space        | boolean feature known                | 1/0                                             |
| condition            | condition string present             | 1                                               |
| energy_efficiency    | energy rating present                | 1                                               |
| accessibility        | accessibility flag known             | 1/0                                             |
| investment_potential | **never** in v1                      | always missing                                  |

## Unsupported / unavailable in inventory today

Energy rating, condition, usable area (often), school/hospital proximity, recurring expenses, off-plan flags, outdoor/accessibility features — shown as **unavailable**, never invented.

## Disclaimer

Mandatory UI/API key `suitability_not_valuation`: preference fit only — not valuation, legal opinion, or investment guarantee.

## Output

Per listing: `score`, `factors[]` (key, weight, factScore, contribution, sourceValue), `missing[]`, `explanation`, `scoreModelVersion`.
