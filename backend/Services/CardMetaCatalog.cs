using ClashRoyaleMetaAnalytics.Models;

namespace ClashRoyaleMetaAnalytics.Services
{
    public record CardMetadata(
        string PrimaryRole,
        string AttackType,
        bool IsWinCondition,
        bool IsBuilding,
        bool IsLightSpell,
        bool IsHeavySpell,
        bool IsCycleCard,
        bool CanHitAir,
        bool IsTank,
        bool IsSplash,
        bool IsReset
    );

    public class CardMetaCatalog
    {
        private static readonly Dictionary<string, CardMetadata> Catalog = new(StringComparer.OrdinalIgnoreCase)
        {
            ["hog rider"] = new("WinCondition", "Ground", true, false, false, false, false, false, false, false, false),
            ["royal giant"] = new("WinCondition", "Ground", true, false, false, false, false, false, true, false, false),
            ["golem"] = new("WinCondition", "Ground", true, false, false, false, false, false, true, false, false),
            ["giant"] = new("WinCondition", "Ground", true, false, false, false, false, false, true, false, false),
            ["lava hound"] = new("WinCondition", "Air", true, false, false, false, false, true, true, false, false),
            ["balloon"] = new("WinCondition", "Air", true, false, false, false, false, false, false, false, false),
            ["miner"] = new("WinCondition", "Ground", true, false, false, false, true, false, false, false, false),
            ["x-bow"] = new("WinCondition", "Ground", true, true, false, false, false, false, false, false, false),
            ["mortar"] = new("WinCondition", "Ground", true, true, false, false, false, true, false, true, false),
            ["goblin barrel"] = new("WinCondition", "Ground", true, false, false, false, true, false, false, false, false),

            ["fireball"] = new("Spell", "Both", false, false, false, true, false, true, false, true, false),
            ["poison"] = new("Spell", "Both", false, false, false, true, false, true, false, true, false),
            ["rocket"] = new("Spell", "Both", false, false, false, true, false, true, false, true, false),
            ["lightning"] = new("Spell", "Both", false, false, false, true, false, true, false, false, false),
            ["the log"] = new("Spell", "Ground", false, false, true, false, false, false, false, false, false),
            ["barbarian barrel"] = new("Spell", "Ground", false, false, true, false, false, false, true, false, false),
            ["zap"] = new("Spell", "Both", false, false, true, false, false, true, false, false, true),
            ["snowball"] = new("Spell", "Both", false, false, true, false, false, true, false, false, false),
            ["arrows"] = new("Spell", "Both", false, false, true, false, false, true, false, true, false),
            ["tornado"] = new("Spell", "Both", false, false, true, false, false, true, false, false, false),

            ["cannon"] = new("Defense", "Ground", false, true, false, false, false, false, false, false, false),
            ["tesla"] = new("Defense", "Both", false, true, false, false, false, true, false, false, false),
            ["bomb tower"] = new("Defense", "Ground", false, true, false, false, false, false, true, true, false),
            ["inferno tower"] = new("Defense", "Both", false, true, false, false, false, true, false, false, false),
            ["tombstone"] = new("Defense", "Ground", false, true, false, false, true, false, false, false, false),

            ["musketeer"] = new("Support", "Both", false, false, false, false, false, true, false, false, false),
            ["archers"] = new("Support", "Both", false, false, false, false, true, true, false, false, false),
            ["electro wizard"] = new("Support", "Both", false, false, false, false, false, true, false, false, true),
            ["baby dragon"] = new("Support", "Both", false, false, false, false, false, true, true, true, false),
            ["phoenix"] = new("Support", "Both", false, false, false, false, false, true, true, false, false),
            ["minions"] = new("Support", "Air", false, false, false, false, true, true, false, false, false),
            ["bats"] = new("Support", "Air", false, false, false, false, true, true, false, false, false),
            ["skeletons"] = new("Cycle", "Ground", false, false, false, false, true, false, false, false, false),
            ["ice spirit"] = new("Cycle", "Both", false, false, false, false, true, true, false, false, false),
            ["goblins"] = new("Cycle", "Ground", false, false, false, false, true, false, false, false, false),
            ["knight"] = new("Support", "Ground", false, false, false, false, false, false, true, false, false),
            ["valkyrie"] = new("Support", "Ground", false, false, false, false, false, false, true, true, false),
            ["mini p.e.k.k.a"] = new("Support", "Ground", false, false, false, false, false, false, false, false, false)
        };

        private static readonly HashSet<string> EvolutionSlugs = new(StringComparer.OrdinalIgnoreCase)
        {
            "archers", "bats", "barbarians", "battle-ram", "baby-dragon", "bomber", "cannon", "dart-goblin",
            "electro-dragon", "executioner", "firecracker", "furnace", "giant-snowball", "goblin-barrel",
            "goblin-cage", "goblin-drill", "goblin-giant", "hunter", "ice-spirit", "inferno-dragon",
            "knight", "lumberjack", "mega-knight", "mortar", "musketeer", "pekka", "royal-ghost",
            "royal-giant", "royal-hogs", "royal-recruits", "skeleton-army", "skeleton-barrel", "skeletons", "minion-horde",
            "tesla", "the-log", "valkyrie", "wall-breakers", "witch", "wizard", "x-bow", "zap"
        };

        // External evolved portraits (fallback to base icon when absent)
        private static readonly Dictionary<string, string> EvoPortraitUrls = new(StringComparer.OrdinalIgnoreCase)
        {
            ["archers"] = "https://vignette.wikia.nocookie.net/clashroyale/images/4/40/Evolved_Archers_card_render.png/revision/latest/scale-to-width-down/256?cb=20231007133403",
            ["knight"] = "https://vignette.wikia.nocookie.net/clashroyale/images/b/b0/Evolved_Knight_card_render.png/revision/latest/scale-to-width-down/256?cb=20230820162036",
            ["bats"] = "https://vignette.wikia.nocookie.net/clashroyale/images/2/29/Evolved_Bats_card_render.png/revision/latest/scale-to-width-down/256?cb=20240930215840",
            ["skeletons"] = "https://vignette.wikia.nocookie.net/clashroyale/images/e/e3/Evolved_Skeletons_card_render.png/revision/latest/scale-to-width-down/256?cb=20230704032753",
            ["zap"] = "https://vignette.wikia.nocookie.net/clashroyale/images/e/e2/Evolved_Zap_card_render.png/revision/latest/scale-to-width-down/256?cb=20240311041020",
            ["tesla"] = "https://vignette.wikia.nocookie.net/clashroyale/images/7/7d/Evolved_Tesla_card_render.png/revision/latest/scale-to-width-down/256?cb=20240303095431",
            ["royal giant"] = "https://vignette.wikia.nocookie.net/clashroyale/images/f/f1/Evolved_Royal_Giant_card_render.png/revision/latest/scale-to-width-down/256?cb=20230704032800",
            ["mortar"] = "https://vignette.wikia.nocookie.net/clashroyale/images/b/bf/Evolved_Mortar_card_render.png/revision/latest/scale-to-width-down/256?cb=20230704032758",
            ["bomber"] = "https://vignette.wikia.nocookie.net/clashroyale/images/e/e7/Evolved_Bomber_card_render.png/revision/latest/scale-to-width-down/256?cb=20240205085358",
            ["firecracker"] = "https://vignette.wikia.nocookie.net/clashroyale/images/5/58/Evolved_Firecracker_card_render.png/revision/latest/scale-to-width-down/256?cb=20230903203945",
            ["valkyrie"] = "https://vignette.wikia.nocookie.net/clashroyale/images/7/77/Evolved_Valkyrie_card_render.png/revision/latest/scale-to-width-down/256?cb=20231204191544",
            ["barbarians"] = "https://vignette.wikia.nocookie.net/clashroyale/images/5/53/Evolved_Barbarians_card_render.png/revision/latest/scale-to-width-down/256?cb=20230704032749",
            ["battle ram"] = "https://vignette.wikia.nocookie.net/clashroyale/images/a/a0/Evolved_Battle_Ram_card_render.png/revision/latest/scale-to-width-down/256?cb=20240819084841",
            ["cannon"] = "https://vignette.wikia.nocookie.net/clashroyale/images/b/b0/Evolved_Cannon_card_render.png/revision/latest/scale-to-width-down/256?cb=20241118041509",
            ["baby dragon"] = "https://vignette.wikia.nocookie.net/clashroyale/images/8/87/Evolved_Baby_Dragon_card_render.png/revision/latest/scale-to-width-down/256?cb=20250505090244",
            ["minion horde"] = "https://cdn.royaleapi.com/static/img/cards-150/minion-horde-ev1.png"
        };

        private static readonly HashSet<string> HeroSlugs = new(StringComparer.OrdinalIgnoreCase)
        {
            // Current hero variants
            "barbarian-barrel", "giant", "goblins", "ice-golem", "knight", "magic-archer",
            "mega-minion", "mini-pekka", "musketeer", "wizard",

            // Extra cards requested by user to track as hero-capable in UI
            "balloon", "prince"
        };

        private static readonly HashSet<string> ChampionCards = new(StringComparer.OrdinalIgnoreCase)
        {
            "archer queen", "golden knight", "mighty miner", "little prince", "monk", "skeleton king", "goblinstein", "boss bandit"
        };

        public void ApplyMetadata(Card card)
        {
            var key = Normalize(card.Name);
            if (Catalog.TryGetValue(key, out var metadata))
            {
                card.Role = metadata.PrimaryRole;
                card.AttackType = metadata.AttackType;
            }
            else
            {
                ApplyFallbackHeuristics(card);
            }

            ApplySpecialSlotMetadata(card);
        }

        public CardMetadata GetMetadata(Card card)
        {
            var key = Normalize(card.Name);
            if (Catalog.TryGetValue(key, out var metadata))
            {
                return metadata;
            }

            var isSpell = card.Role.Equals("Spell", StringComparison.OrdinalIgnoreCase);
            var canHitAir = card.AttackType.Equals("Both", StringComparison.OrdinalIgnoreCase)
                            || card.AttackType.Equals("Air", StringComparison.OrdinalIgnoreCase);

            return new CardMetadata(
                string.IsNullOrWhiteSpace(card.Role) ? "Support" : card.Role,
                string.IsNullOrWhiteSpace(card.AttackType) ? "Ground" : card.AttackType,
                card.Role.Equals("WinCondition", StringComparison.OrdinalIgnoreCase),
                false,
                isSpell,
                false,
                card.ElixirCost <= 2,
                canHitAir,
                card.ElixirCost >= 4,
                false,
                false
            );
        }

        private static void ApplySpecialSlotMetadata(Card card)
        {
            var key = Normalize(card.Name);
            var slug = ToSlug(card.Name);

            card.IsEvolution = EvolutionSlugs.Contains(slug);
            card.IsChampion = card.Rarity.Equals("champion", StringComparison.OrdinalIgnoreCase) || ChampionCards.Contains(key);
            card.IsHero = HeroSlugs.Contains(slug);

            if (card.IsEvolution)
            {
                if (EvoPortraitUrls.TryGetValue(key, out var evoUrl))
                {
                    card.EvoIconUrl = evoUrl;
                }
                else
                {
                    card.EvoIconUrl = BuildWikiaEvoUrl(card.Name);
                }
            }

            var allowed = new List<string> { "normal" };
            if (card.IsEvolution)
            {
                allowed.Add("evo");
            }

            if (card.IsHero || card.IsChampion)
            {
                allowed.Add("hero");
            }

            if (card.IsEvolution || card.IsHero || card.IsChampion)
            {
                allowed.Add("wild");
            }

            card.AllowedSlots = allowed;
        }

        private static string BuildWikiaEvoUrl(string cardName)
        {
            var cleaned = cardName.Replace(".", "").Replace("'", "").Replace("-", " ").Trim();
            var parts = cleaned
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => char.ToUpperInvariant(p[0]) + p.Substring(1).ToLowerInvariant());
            var wikiName = string.Join("_", parts);
            return $"https://vignette.wikia.nocookie.net/clashroyale/images/0/00/Evolved_{wikiName}_card_render.png/revision/latest/scale-to-width-down/256";
        }

        private static string Normalize(string value) => value.Trim().ToLowerInvariant();

        private static string ToSlug(string value)
        {
            return value
                .Trim()
                .ToLowerInvariant()
                .Replace(".", "")
                .Replace("'", "")
                .Replace("&", "and")
                .Replace(" ", "-")
                .Replace("--", "-");
        }

        private static void ApplyFallbackHeuristics(Card card)
        {
            var name = Normalize(card.Name);

            if (name.Contains("hog") || name.Contains("giant") || name.Contains("golem") || name.Contains("balloon") || name.Contains("barrel"))
            {
                card.Role = "WinCondition";
            }
            else if (name.Contains("fireball") || name.Contains("zap") || name.Contains("log") || name.Contains("poison") || name.Contains("rocket"))
            {
                card.Role = "Spell";
            }
            else if (name.Contains("cannon") || name.Contains("tesla") || name.Contains("tower") || name.Contains("tombstone"))
            {
                card.Role = "Defense";
            }
            else if (card.ElixirCost <= 2)
            {
                card.Role = "Cycle";
            }
            else
            {
                card.Role = "Support";
            }

            if (string.IsNullOrWhiteSpace(card.AttackType))
            {
                card.AttackType = (name.Contains("baby dragon") || name.Contains("minion") || name.Contains("bats") || name.Contains("archer") || name.Contains("musketeer"))
                    ? "Both"
                    : "Ground";
            }
        }
    }
}


