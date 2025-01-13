using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BlazorEditor.Models
{
    public class Delta
    {
        [JsonPropertyName("ops")]
        public List<Op> Ops { get; set; } = new List<Op>();
    }

    public class Op
    {
        [JsonPropertyName("insert")]
        public object Insert { get; set; }

        [JsonPropertyName("attributes")]
        public Dictionary<string, object> Attributes { get; set; }
    }
}
