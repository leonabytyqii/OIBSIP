const pizzas = [
  {
    id: "margherita",
    name: "Margherita",
    description: "Tomato sauce, mozzarella and fresh basil.",
  },
  {
    id: "veggie",
    name: "Veggie",
    description: "Tomato sauce, mozzarella, peppers, mushrooms and olives.",
  },
  {
    id: "pepperoni",
    name: "Pepperoni",
    description: "Tomato sauce, mozzarella and pepperoni.",
  },
];

export default function Dashboard({ user, onLogout }) {
  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Welcome, {user.name}!</h2>
          <p>Explore our pizza menu.</p>
        </div>

        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </header>

      <h2>Our pizzas</h2>

      <div className="pizza-grid">
        {pizzas.map((pizza) => (
          <article className="pizza-card" key={pizza.id}>
            <span className="pizza-icon" aria-hidden="true">
              🍕
            </span>

            <h3>{pizza.name}</h3>
            <p>{pizza.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}