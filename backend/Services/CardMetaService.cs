using ClashRoyaleMetaAnalytics.Models;

namespace ClashRoyaleMetaAnalytics.Services
{
    public class CardMetaService
    {
        private static readonly Dictionary<string, (string Role, string AttackType)> Meta =
            new()
            {
                { "Hog Rider", ("WinCondition", "Ground") },
                { "Knight", ("Tank", "Ground") },
                { "Fireball", ("Spell", "Both") },
                { "Log", ("Spell", "Ground") },
                { "Musketeer", ("Support", "Both") },
                { "Archers", ("Support", "Both") },
                { "Ice Spirit", ("Support", "Both") },
                { "Cannon", ("Defense", "Ground") }
            };

        public void ApplyMeta(Card card)
        {
            if (Meta.TryGetValue(card.Name, out var meta))
            {
                card.Role = meta.Role;
                card.AttackType = meta.AttackType;
            }
        }
    }
}
