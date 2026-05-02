using ClashRoyaleMetaAnalytics.DTOs;
using ClashRoyaleMetaAnalytics.Models;
using ClashRoyaleMetaAnalytics.Services;
using System.Text.Json;

namespace ClashRoyaleMetaAnalytics.Clients
{
    public class ClashRoyaleClient
    {
        private readonly HttpClient _httpClient;
        private readonly CardMetaCatalog _metaCatalog;

        public ClashRoyaleClient(HttpClient httpClient, CardMetaCatalog metaCatalog)
        {
            _httpClient = httpClient;
            _metaCatalog = metaCatalog;
        }

        public async Task<CardListResponse> GetCardsAsync()
        {
            var response = await _httpClient.GetAsync("cards");
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<CardListResponse>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

            foreach (var card in data.Items)
            {
                _metaCatalog.ApplyMetadata(card);
            }

            return data;
        }
    }
}
