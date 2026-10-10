
// =====================================
// 1. SEARCH
// =====================================

const searchForm = document.querySelector(".search-box");

if (searchForm) {
    searchForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const searchInput = document.getElementById("searchInput");
        const searchValue = searchInput.value.trim();

        if (searchValue.length > 0) {
            alert("Searching for: " + searchValue);
        } else {
            searchInput.focus();
        }
    });
}


// =====================================
// 2. SCROLL REVEAL ANIMATION
// =====================================

const revealElements = document.querySelectorAll(
    ".about-content, " +
    ".about-image-box, " +
    ".about-feature, " +
    ".quick-services-heading, " +
    ".quick-service, " +
    ".footer-brand, " +
    ".footer-column, " +
    ".footer-bottom"
);

revealElements.forEach(function (element, index) {
    element.classList.add("scroll-reveal");

    // Cards appear one after another
    if (
        element.classList.contains("about-feature") ||
        element.classList.contains("quick-service")
    ) {
        element.style.setProperty(
            "--reveal-delay",
            (index % 6) * 100 + "ms"
        );
    }
});

if ("IntersectionObserver" in window) {

    const revealObserver = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {

                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                } else {
                    // Hide the element when it leaves the screen
                    entry.target.classList.remove("is-visible");
                }

            });
        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -35px 0px"
        }
    );

    revealElements.forEach(function (element) {
        revealObserver.observe(element);
    });

} else {

    // Show elements if IntersectionObserver is unavailable
    revealElements.forEach(function (element) {
        element.classList.add("is-visible");
    });

}


// =====================================
// 3. NAVIGATION ACTIVE SECTION
// =====================================

const navLinks = document.querySelectorAll("nav a");

const pageSections = document.querySelectorAll(
    ".hero, .about-section, .quick-services, .careplus-footer"
);


// Update the active navigation link
function setActiveLink(sectionId) {

    navLinks.forEach(function (link) {

        const linkTarget = link.getAttribute("href");

        link.classList.toggle(
            "active",
            linkTarget === "#" + sectionId
        );

    });

}


// Update navigation when clicking a link
navLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        const targetId = this.getAttribute("href");

        if (targetId && targetId.startsWith("#")) {

            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                setActiveLink(targetSection.id);
            }

        }

    });

});


// Update navigation while scrolling
if ("IntersectionObserver" in window) {

    const sectionObserver = new IntersectionObserver(
        function (entries) {

            const visibleSections = entries
                .filter(function (entry) {
                    return entry.isIntersecting;
                })
                .sort(function (a, b) {
                    return b.intersectionRatio - a.intersectionRatio;
                });

            if (visibleSections.length > 0) {
                setActiveLink(visibleSections[0].target.id);
            }

        },
        {
            rootMargin: "-15% 0px -55% 0px",
            threshold: [0, 0.1, 0.25, 0.5]
        }
    );

    pageSections.forEach(function (section) {

        if (section.id) {
            sectionObserver.observe(section);
        }

    });

}

   // Reveal cards when the section enters the screen
        const cards = document.querySelectorAll(".step-card");

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15
        });

        cards.forEach((card) => {
            observer.observe(card);
        });

        // Button interaction
        const startBtn = document.getElementById("startBtn");

        startBtn.addEventListener("click", (event) => {
            const target = document.querySelector("#top");

            if (!target) {
                event.preventDefault();

                // Replace this with your real booking or signup page.
                startBtn.innerHTML =
                    'Explore Our Services <i class="fa-solid fa-arrow-right"></i>';

                document.querySelector(".section-header")
                    .scrollIntoView({ behavior: "smooth" });
            }
        });