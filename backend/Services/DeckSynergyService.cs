using ClashRoyaleMetaAnalytics.Models;

namespace ClashRoyaleMetaAnalytics.Services
{
    public class DeckSynergyService
    {
        private readonly CardMetaCatalog _metaCatalog;

        public DeckSynergyService(CardMetaCatalog metaCatalog)
        {
            _metaCatalog = metaCatalog;
        }

        public SynergyResult CalculateSynergy(List<Card> cards, string? towerTroop = null)
        {
            var result = new SynergyResult();
            result.TowerTroop = NormalizeTowerTroop(towerTroop);

            if (cards.Count != 8)
            {
                result.Weaknesses.Add("Deck must contain exactly 8 cards for accurate analysis.");
            }

            result.AverageElixir = cards.Average(c => c.ElixirCost);
            var metadata = cards.ToDictionary(c => c.Id, c => _metaCatalog.GetMetadata(c));

            var winCons = cards.Where(c => metadata[c.Id].IsWinCondition).Select(c => c.Name).Distinct().ToList();
            result.WinConditions = winCons;

            int offenseScore = ScoreOffense(cards, metadata, result);
            int defenseScore = ScoreDefense(cards, metadata, result);
            int spellScore = ScoreSpells(cards, metadata, result);
            int cycleScore = ScoreCycle(cards, metadata, result);
            int consistencyScore = ScoreConsistency(cards, metadata, result);

            result.SubScores["Offense"] = offenseScore;
            result.SubScores["Defense"] = defenseScore;
            result.SubScores["Spells"] = spellScore;
            result.SubScores["Cycle"] = cycleScore;
            result.SubScores["Consistency"] = consistencyScore;

            result.TotalScore = offenseScore + defenseScore + spellScore + cycleScore + consistencyScore;
            ApplyTowerTroopImpact(result, metadata);

            result.RoleDistribution = cards
                .GroupBy(c => c.Role)
                .ToDictionary(g => g.Key, g => g.Count());

            var archetype = DetectArchetype(cards, metadata, result.AverageElixir, winCons, out var confidence);
            result.DeckType = archetype;
            result.ArchetypeConfidence = confidence;

            result.Matchups = BuildMatchups(archetype);

            BuildRecommendations(result, metadata);

            return result;
        }

        private static string NormalizeTowerTroop(string? towerTroop)
        {
            if (string.IsNullOrWhiteSpace(towerTroop))
            {
                return "tower_princess";
            }

            var key = towerTroop.Trim().ToLowerInvariant()
                .Replace("-", "_")
                .Replace(" ", "_");

            return key switch
            {
                "tower_princess" => "tower_princess",
                "cannoneer" => "cannoneer",
                "dagger_duchess" => "dagger_duchess",
                "royal_chef" => "royal_chef",
                _ => "tower_princess"
            };
        }

        private static void ApplyTowerTroopImpact(SynergyResult result, Dictionary<int, CardMetadata> metadata)
        {
            var canHitAir = metadata.Values.Count(m => m.CanHitAir);
            var heavyCount = metadata.Values.Count(m => m.IsTank);
            var cheapCount = metadata.Values.Count(m => m.IsCycleCard);
            var splashCount = metadata.Values.Count(m => m.IsSplash);

            int bonus = 0;

            switch (result.TowerTroop)
            {
                case "cannoneer":
                    // Stronger single-target style: reward sturdy anti-air support and swarm answers.
                    if (canHitAir >= 3)
                    {
                        bonus += 2;
                        result.TowerImpact["Air Support Synergy"] = 2;
                    }
                    else
                    {
                        bonus -= 2;
                        result.TowerImpact["Air Support Synergy"] = -2;
                        result.Weaknesses.Add("Cannoneer build may struggle without enough anti-air support.");
                    }

                    if (splashCount >= 2)
                    {
                        bonus += 2;
                        result.TowerImpact["Swarm Cover Synergy"] = 2;
                    }
                    else
                    {
                        bonus -= 1;
                        result.TowerImpact["Swarm Cover Synergy"] = -1;
                    }
                    break;

                case "dagger_duchess":
                    // Higher burst control: reward cycle/control shells.
                    if (cheapCount >= 2)
                    {
                        bonus += 3;
                        result.TowerImpact["Cycle Tempo Synergy"] = 3;
                    }
                    else
                    {
                        bonus -= 1;
                        result.TowerImpact["Cycle Tempo Synergy"] = -1;
                    }
                    break;

                case "royal_chef":
                    // Better in beefier setups.
                    if (heavyCount >= 2)
                    {
                        bonus += 3;
                        result.TowerImpact["Frontline Synergy"] = 3;
                    }
                    else
                    {
                        bonus -= 1;
                        result.TowerImpact["Frontline Synergy"] = -1;
                    }
                    break;

                default:
                    // Tower Princess baseline, no bonus.
                    result.TowerImpact["Baseline"] = 0;
                    break;
            }

            result.TotalScore += bonus;
            result.TotalScore = Math.Max(0, result.TotalScore);
        }

        private int ScoreOffense(List<Card> cards, Dictionary<int, CardMetadata> metadata, SynergyResult result)
        {
            int score = 0;
            var winConCount = metadata.Values.Count(m => m.IsWinCondition);

            if (winConCount == 1)
            {
                var supportForWinCon = cards.Count(c => c.Role == "Support" || c.Role == "Tank");
                var clarity = supportForWinCon >= 3 ? 14 : 10;
                score += clarity;
                result.Breakdown["Win Condition Clarity"] = clarity;
                result.Strengths.Add("One primary win path identified.");
            }
            else if (winConCount == 2)
            {
                score += 16;
                result.Breakdown["Win Condition Clarity"] = 16;
                result.Strengths.Add("Two offensive paths available.");
            }
            else
            {
                score += 4;
                result.Breakdown["Win Condition Clarity"] = 4;
                result.Weaknesses.Add("No clear win condition detected.");
            }

            var supportCount = cards.Count(c => c.Role == "Support" || c.Role == "Tank");
            if (supportCount >= 2)
            {
                score += 8;
                result.Breakdown["Support Package"] = 8;
            }
            else
            {
                score += 4;
                result.Breakdown["Support Package"] = 4;
                result.Weaknesses.Add("Limited support for offense.");
            }

            return score;
        }

        private int ScoreDefense(List<Card> cards, Dictionary<int, CardMetadata> metadata, SynergyResult result)
        {
            int score = 0;

            int airCounters = metadata.Values.Count(m => m.CanHitAir);
            if (airCounters >= 3)
            {
                score += 12;
                result.Breakdown["Air Defense"] = 12;
                result.Strengths.Add("Reliable anti-air coverage.");
            }
            else
            {
                score += 5;
                result.Breakdown["Air Defense"] = 5;
                result.Weaknesses.Add("Air defense may be unreliable.");
            }

            int buildingCount = metadata.Values.Count(m => m.IsBuilding);
            if (buildingCount >= 1)
            {
                score += 10;
                result.Breakdown["Building Coverage"] = 10;
            }
            else
            {
                score += 4;
                result.Breakdown["Building Coverage"] = 4;
                result.Weaknesses.Add("No defensive building detected.");
            }

            int splashCount = metadata.Values.Count(m => m.IsSplash);
            if (splashCount >= 2)
            {
                score += 8;
                result.Breakdown["Swarm Control"] = 8;
            }
            else
            {
                score += 4;
                result.Breakdown["Swarm Control"] = 4;
            }

            return score;
        }

        private int ScoreSpells(List<Card> cards, Dictionary<int, CardMetadata> metadata, SynergyResult result)
        {
            int score = 0;

            var spellCount = cards.Count(c => c.Role == "Spell");
            var lightSpellCount = metadata.Values.Count(m => m.IsLightSpell);
            var heavySpellCount = metadata.Values.Count(m => m.IsHeavySpell);

            if (spellCount >= 2)
            {
                score += 8;
                result.Breakdown["Spell Count"] = 8;
            }
            else
            {
                score += 3;
                result.Breakdown["Spell Count"] = 3;
                result.Weaknesses.Add("Deck may be under-spelled.");
            }

            if (lightSpellCount >= 1 && heavySpellCount >= 1)
            {
                score += 10;
                result.Breakdown["Spell Balance"] = 10;
                result.Strengths.Add("Healthy light + heavy spell pairing.");
            }
            else
            {
                score += 4;
                result.Breakdown["Spell Balance"] = 4;
                result.Weaknesses.Add("Spell package lacks balance.");
            }

            var resetCount = metadata.Values.Count(m => m.IsReset);
            if (resetCount > 0)
            {
                score += 7;
                result.Breakdown["Reset Access"] = 7;
            }
            else
            {
                score += 3;
                result.Breakdown["Reset Access"] = 3;
            }

            return score;
        }

        private int ScoreCycle(List<Card> cards, Dictionary<int, CardMetadata> metadata, SynergyResult result)
        {
            int score = 0;
            var avgElixir = result.AverageElixir;
            var cycleCardCount = metadata.Values.Count(m => m.IsCycleCard);

            if (avgElixir <= 3.2)
            {
                score += 12;
                result.Breakdown["Cycle Speed"] = 12;
            }
            else if (avgElixir <= 3.8)
            {
                score += 9;
                result.Breakdown["Cycle Speed"] = 9;
            }
            else
            {
                score += 5;
                result.Breakdown["Cycle Speed"] = 5;
            }

            if (cycleCardCount >= 2)
            {
                score += 8;
                result.Breakdown["Cheap Cycle Support"] = 8;
            }
            else
            {
                score += 4;
                result.Breakdown["Cheap Cycle Support"] = 4;
            }

            return score;
        }

        private int ScoreConsistency(List<Card> cards, Dictionary<int, CardMetadata> metadata, SynergyResult result)
        {
            int score = 0;
            var avgElixir = result.AverageElixir;
            var tankCount = metadata.Values.Count(m => m.IsTank);
            var winConCount = metadata.Values.Count(m => m.IsWinCondition);

            if (avgElixir is >= 2.8 and <= 4.3)
            {
                score += 10;
                result.Breakdown["Elixir Balance"] = 10;
            }
            else
            {
                score += 5;
                result.Breakdown["Elixir Balance"] = 5;
                result.Weaknesses.Add("Elixir profile is outside ideal range.");
            }

            if (tankCount >= 1 || winConCount >= 1)
            {
                score += 8;
                result.Breakdown["Frontline Presence"] = 8;
            }
            else
            {
                score += 3;
                result.Breakdown["Frontline Presence"] = 3;
            }

            if (cards.Select(c => c.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() == cards.Count)
            {
                score += 7;
                result.Breakdown["Card Uniqueness"] = 7;
            }
            else
            {
                result.Breakdown["Card Uniqueness"] = 0;
                result.Weaknesses.Add("Duplicate cards detected.");
            }

            return score;
        }

        private static string DetectArchetype(
            List<Card> cards,
            Dictionary<int, CardMetadata> metadata,
            double avgElixir,
            List<string> winCons,
            out int confidence)
        {
            var names = cards.Select(c => c.Name.ToLowerInvariant()).ToList();

            if (names.Any(n => n.Contains("x-bow")))
            {
                confidence = 92;
                return "Siege";
            }

            if (names.Any(n => n.Contains("lava")) || names.Any(n => n.Contains("balloon")))
            {
                confidence = 85;
                return "Air Beatdown";
            }

            if (avgElixir >= 4.2 && winCons.Count > 0)
            {
                confidence = 82;
                return "Beatdown";
            }

            if (avgElixir <= 3.2 && metadata.Values.Count(m => m.IsCycleCard) >= 2)
            {
                confidence = 84;
                return "Cycle";
            }

            if (names.Any(n => n.Contains("battle ram")) || names.Any(n => n.Contains("bandit")))
            {
                confidence = 72;
                return "Bridge Spam";
            }

            confidence = 70;
            return "Control";
        }

        private static Dictionary<string, string> BuildMatchups(string archetype)
        {
            return archetype switch
            {
                "Beatdown" => new Dictionary<string, string>
                {
                    ["Strong Against"] = "Cycle",
                    ["Weak Against"] = "Control"
                },
                "Air Beatdown" => new Dictionary<string, string>
                {
                    ["Strong Against"] = "Ground Beatdown",
                    ["Weak Against"] = "Heavy Anti-Air Control"
                },
                "Cycle" => new Dictionary<string, string>
                {
                    ["Strong Against"] = "Control",
                    ["Weak Against"] = "Beatdown"
                },
                "Siege" => new Dictionary<string, string>
                {
                    ["Strong Against"] = "Slow Beatdown",
                    ["Weak Against"] = "Fast Pressure Cycle"
                },
                _ => new Dictionary<string, string>
                {
                    ["Strong Against"] = "Beatdown",
                    ["Weak Against"] = "Cycle"
                }
            };
        }

        private static void BuildRecommendations(SynergyResult result, Dictionary<int, CardMetadata> metadata)
        {
            if (result.WinConditions.Count == 0)
            {
                result.Recommendations.Add("Add one clear win condition (e.g., Hog Rider, Giant, Balloon, Miner, X-Bow).");
            }

            if (metadata.Values.Count(m => m.IsBuilding) == 0)
            {
                result.Recommendations.Add("Consider adding a defensive building for stronger matchup spread.");
            }

            if (metadata.Values.Count(m => m.IsLightSpell) == 0)
            {
                result.Recommendations.Add("Add a light spell (Log/Zap/Snowball/Arrows) for cheap control.");
            }

            if (metadata.Values.Count(m => m.IsHeavySpell) == 0)
            {
                result.Recommendations.Add("Add a heavy spell (Fireball/Poison/Rocket/Lightning) for reliable finishing and medium-unit control.");
            }

            if (result.AverageElixir > 4.5)
            {
                result.Recommendations.Add("Your deck is very heavy; consider 1-2 cheaper cycle cards.");
            }

            if (result.AverageElixir < 2.8)
            {
                result.Recommendations.Add("Your deck is very light; consider adding a sturdier defensive core.");
            }

            if (result.Recommendations.Count == 0)
            {
                result.Recommendations.Add("Deck structure looks balanced. Next step: validate using battle-performance data.");
            }
        }
    }
}
