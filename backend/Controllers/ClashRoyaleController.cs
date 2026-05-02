using ClashRoyaleMetaAnalytics.Clients;
using Microsoft.AspNetCore.Mvc;

namespace ClashRoyaleMetaAnalytics.Controllers
{
    [ApiController]
    [Route("api/clashroyale")]
    public class ClashRoyaleController : ControllerBase
    {
        private readonly ClashRoyaleClient _client;

        public ClashRoyaleController(ClashRoyaleClient client)
        {
            _client = client;
        }

        [HttpGet("cards")]
        public async Task<IActionResult> GetCards()
        {
            var response = await _client.GetCardsAsync();
            return Ok(response.Items);
        }
    }
}
