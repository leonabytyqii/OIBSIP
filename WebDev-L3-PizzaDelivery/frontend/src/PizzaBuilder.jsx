import { useEffect, useState } from "react";

const steps = [
  { category: "base", title: "Choose a pizza base" },
  { category: "sauce", title: "Choose a sauce" },
  { category: "cheese", title: "Choose a cheese" },
  { category: "veggie", title: "Choose vegetables" },
];

export default function PizzaBuilder({ accessToken, onLogout }) {
  const [ingredients, setIngredients] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState({
    base: "",
    sauce: "",
    cheese: "",
    veggie: [],
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadIngredients() {
      setStatus("loading");
      setMessage("");

      try {
        const response = await fetch(
          "http://localhost:5000/api/ingredients",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          if (!controller.signal.aborted) {
            setStatus("expired");
          }
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load ingredients.");
        }

        if (!Array.isArray(data.ingredients)) {
          throw new Error("Invalid ingredient list.");
        }

        if (controller.signal.aborted) return;

        setIngredients(data.ingredients);
        setStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus("error");
        setMessage(
          error instanceof TypeError
            ? "Unable to connect. Please try again."
            : error.message
        );
      }
    }

    loadIngredients();

    return () => controller.abort();
  }, [accessToken, retry]);

  function chooseIngredient(ingredient) {
    if (!ingredient.available) return;

    const category = ingredient.category;

    setSelection((current) => {
      if (category === "veggie") {
        const alreadySelected = current.veggie.includes(ingredient.id);

        return {
          ...current,
          veggie: alreadySelected
            ? current.veggie.filter((id) => id !== ingredient.id)
            : [...current.veggie, ingredient.id],
        };
      }

      return {
        ...current,
        [category]: ingredient.id,
      };
    });
  }

  function getName(id) {
    return ingredients.find((item) => item.id === id)?.name || "";
  }

  if (status === "loading") {
    return <p role="status">Loading pizza ingredients...</p>;
  }

  if (status === "expired") {
    return (
      <div>
        <p role="alert">Your session has expired. Please log in again.</p>
        <button type="button" onClick={onLogout}>
          Back to login
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div>
        <p role="alert">{message}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (step === steps.length) {
    return (
      <section className="pizza-builder">
        <h2>Your pizza selection</h2>

        <p><strong>Base:</strong> {getName(selection.base)}</p>
        <p><strong>Sauce:</strong> {getName(selection.sauce)}</p>
        <p><strong>Cheese:</strong> {getName(selection.cheese)}</p>
        <p>
          <strong>Vegetables:</strong>{" "}
          {selection.veggie.length > 0
            ? selection.veggie.map(getName).join(", ")
            : "None"}
        </p>

        <button type="button" onClick={() => setStep(0)}>
          Edit selection
        </button>
      </section>
    );
  }

  const currentStep = steps[step];
  const options = ingredients.filter(
    (item) => item.category === currentStep.category
  );

  const canContinue =
    currentStep.category === "veggie" ||
    options.some(
      (item) =>
        item.id === selection[currentStep.category] && item.available
    );

  return (
    <section className="pizza-builder">
      <h2>Build your pizza</h2>
      <p>Step {step + 1} of {steps.length}</p>

      <fieldset className="ingredient-options">
        <legend>{currentStep.title}</legend>

        {currentStep.category === "veggie" && (
          <p>Select several vegetables, or continue without vegetables.</p>
        )}

        {options.length === 0 && <p>No options are available.</p>}

        {options.map((ingredient) => {
          const multiple = currentStep.category === "veggie";

          const checked = multiple
            ? selection.veggie.includes(ingredient.id)
            : selection[currentStep.category] === ingredient.id;

          return (
            <label className="ingredient-option" key={ingredient.id}>
              <input
                type={multiple ? "checkbox" : "radio"}
                name={currentStep.category}
                value={ingredient.id}
                checked={checked}
                disabled={!ingredient.available}
                onChange={() => chooseIngredient(ingredient)}
              />

              <span>
                {ingredient.name}
                {!ingredient.available && " — Out of stock"}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="builder-actions">
        {step > 0 && (
          <button type="button" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        )}

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => setStep((value) => value + 1)}
        >
          {step === steps.length - 1 ? "Review selection" : "Next"}
        </button>
      </div>
    </section>
  );
}