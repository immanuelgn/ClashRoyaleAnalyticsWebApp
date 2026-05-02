namespace ClashRoyaleMetaAnalytics.Models
{
    public class Card
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public int ElixirCost { get; set; }
        public string Rarity { get; set; } = "";
        public CardIconUrls IconUrls { get; set; } = new();

        // Derived fields (not from API)
        public string Role { get; set; } = "";
        public string AttackType { get; set; } = "";

        // Special slot metadata
        public bool IsEvolution { get; set; }
        public bool IsHero { get; set; }
        public bool IsChampion { get; set; }
        public string EvoIconUrl { get; set; } = "";
        public List<string> AllowedSlots { get; set; } = new();
    }

    public class CardIconUrls
    {
        public string Medium { get; set; } = "";
    }
}
