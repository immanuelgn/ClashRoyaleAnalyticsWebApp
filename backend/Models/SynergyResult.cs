namespace ClashRoyaleMetaAnalytics.Models
{
    public class SynergyResult
    {
        public int TotalScore { get; set; }
        public double AverageElixir { get; set; }
        public string DeckType { get; set; } = "Unknown";

        public Dictionary<string, int> Breakdown { get; set; } = new();
        public Dictionary<string, int> SubScores { get; set; } = new();
        public Dictionary<string, int> RoleDistribution { get; set; } = new();
        public Dictionary<string, string> Matchups { get; set; } = new();

        public List<string> WinConditions { get; set; } = new();
        public List<string> Strengths { get; set; } = new();
        public List<string> Weaknesses { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
        public int ArchetypeConfidence { get; set; }
        public string TowerTroop { get; set; } = "tower_princess";
        public Dictionary<string, int> TowerImpact { get; set; } = new();
    }
}
