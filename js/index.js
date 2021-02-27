function initIndexPage(){
    let url = "https://opentdb.com/api_category.php";
    $.getJSON(url, function (json) {
        let categories = json.trivia_categories;
        let html = '<option value="">Any Category</option>';
        for (let i = 0; i < categories.length; i++) {
            html += "<option value=" + categories[i].id + ">" + categories[i].name + "</option>"

        }
        document.getElementById("category").innerHTML = html;
    });

    var forms = document.querySelectorAll('.needs-validation')
    Array.prototype.slice.call(forms)
        .forEach(function (form) {
            form.addEventListener('submit', function (event) {
                if (!form.checkValidity()) {
                    event.preventDefault()
                    event.stopPropagation()
                }
                form.classList.add('was-validated')
            }, false)
        })
}