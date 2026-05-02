using ClashRoyaleMetaAnalytics.Models;

namespace ClashRoyaleMetaAnalytics.Services
{
    public static class CardRoleMapper
    {
        public static void AssignRoles(Card card)
        {
            var name = card.Name.ToLower();

            if (name.Contains("hog") || name.Contains("giant") || name.Contains("golem") || name.Contains("pekka"))
                card.Role = "WinCondition";

            else if (name.Contains("fireball") || name.Contains("zap") || name.Contains("log"))
                card.Role = "Spell";

            else if (name.Contains("cannon") || name.Contains("tesla") || name.Contains("inferno"))
                card.Role = "Defense";

            else
                card.Role = "Support";
        }
    }
}
