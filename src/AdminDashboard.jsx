
import { useEffect, useState } from "react";

const API_URL = "http://localhost:8080/api/admin/crops";

export default function AdminDashboard() {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadPendingCrops() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/pending`);

      if (!response.ok) {
        throw new Error(`Failed to load crops (${response.status})`);
      }

      const data = await response.json();
      setCrops(data);
    } catch (error) {
      setMessage(error.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function approveCrop(cropId) {
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${cropId}/approve`,
        { method: "PUT" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Approval failed.");
      }

      setMessage(`Successfully approved ${data.name}!`);
      await loadPendingCrops();
    } catch (error) {
      setMessage(error.message || "Could not approve crop.");
    }
  }

  useEffect(() => {
    loadPendingCrops();
  }, []);

  return (
    <section className="dashboard-section">
      <div className="dashboard-content">
        <h1>Admin <span>Dashboard</span></h1>
        <p>Review crop submissions before they appear in the marketplace.</p>

        {message && <p className="crop-message">{message}</p>}

        <div className="dashboard-card">
          <h2>Pending Crop Approvals</h2>

          {loading ? (
            <p>Loading pending crops...</p>
          ) : crops.length === 0 ? (
            <p>No crops are waiting for approval.</p>
          ) : (
            <div className="crop-list">
              {crops.map((crop) => (
                <div className="crop-list-item" key={crop.id}>
                  <h3>{crop.name}</h3>
                  <p><strong>Category:</strong> {crop.category}</p>
                  <p><strong>Farmer:</strong> {crop.farmerName}</p>
                  <p><strong>Quantity:</strong> {crop.quantityKg} kg</p>
                  <p><strong>Price:</strong> ₹{crop.pricePerKg}/kg</p>
                  <p>
                    <strong>Description:</strong>{" "}
                    {crop.description || "Not provided"}
                  </p>
                  <p><strong>Status:</strong> Pending approval</p>

                  <button
                    type="button"
                    onClick={() => approveCrop(crop.id)}
                  >
                    Approve Crop
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={loadPendingCrops}
            disabled={loading}
          >
            Refresh List
          </button>
        </div>
      </div>
    </section>
  );
}