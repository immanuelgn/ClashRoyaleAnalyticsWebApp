using System.ComponentModel.DataAnnotations;

namespace ClashRoyaleMetaAnalytics.DTOs
{
    public class DeckRequest
    {
        [Required]
        [MinLength(8)]
        [MaxLength(8)]
        public List<int> CardIds { get; set; } = new();

        public string? TowerTroop { get; set; }
    }
}
