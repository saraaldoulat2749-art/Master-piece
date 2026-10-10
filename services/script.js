// Animate service cards when scrolling
const serviceCards = document.querySelectorAll(".service-card");
const serviceObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            const card = entry.target;
            if (entry.isIntersecting) {
                const index = Array.from(serviceCards).indexOf(card);
                setTimeout(() => {
                    card.classList.add("visible");
                }, (index % 3) * 130);
                serviceObserver.unobserve(card);
            }
        });
    },
    {
        threshold: 0.12
    }
);
serviceCards.forEach((card) => {
    serviceObserver.observe(card);
});
// Update active navigation link
const navLinks = document.querySelectorAll("nav a");
navLinks.forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.forEach((item) => {
            item.classList.remove("active");
        });
        link.classList.add("active");
    });
});