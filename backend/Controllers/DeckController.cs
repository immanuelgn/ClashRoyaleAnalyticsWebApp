using ClashRoyaleMetaAnalytics.Clients;
using ClashRoyaleMetaAnalytics.DTOs;
using ClashRoyaleMetaAnalytics.Services;
using Microsoft.AspNetCore.Mvc;

namespace ClashRoyaleMetaAnalytics.Controllers
{
    [ApiController]
    [Route("api/deck")]
    public class DeckController : ControllerBase
    {
        private readonly ClashRoyaleClient _client;
        private readonly DeckSynergyService _synergyService;

        public DeckController(
            ClashRoyaleClient client,
            DeckSynergyService synergyService)
        {
            _client = client;
            _synergyService = synergyService;
        }

        [HttpPost("synergy")]
        public async Task<IActionResult> AnalyzeDeck([FromBody] DeckRequest request)
        {
            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            if (request.CardIds.Distinct().Count() != 8)
            {
                return BadRequest("Deck must contain 8 unique card IDs.");
            }

            var cardResponse = await _client.GetCardsAsync();

            var deckCards = cardResponse.Items
                .Where(c => request.CardIds.Contains(c.Id))
                .ToList();

            if (deckCards.Count != 8)
            {
                return BadRequest("Some selected card IDs were not found. Please submit 8 valid card IDs.");
            }

            var result = _synergyService.CalculateSynergy(deckCards, request.TowerTroop);

            return Ok(new
            {
                score = result.TotalScore,
                averageElixir = Math.Round(result.AverageElixir, 2),
                archetype = result.DeckType,
                archetypeConfidence = result.ArchetypeConfidence,
                winConditions = result.WinConditions,
                subScores = result.SubScores,
                breakdown = result.Breakdown,
                strengths = result.Strengths,
                weaknesses = result.Weaknesses,
                recommendations = result.Recommendations,
                towerTroop = result.TowerTroop,
                towerImpact = result.TowerImpact,
                roleDistribution = result.RoleDistribution,
                matchups = result.Matchups,
                cards = deckCards.Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.ElixirCost,
                    c.Role,
                    c.AttackType
                })
            });
        }
    }
}
