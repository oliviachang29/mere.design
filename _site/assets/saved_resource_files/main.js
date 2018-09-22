(function($, window, document, undefined) {
    'use strict';

    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    $('.js-item-like').on('click', function(e) {
        e.preventDefault();

        var item = $(this);
        var method = item.hasClass('grid-item-like--active') ? 'DELETE' : 'POST';

        // if like is created from the poup
        if (item.hasClass('grid-item-like--active')) {
            $('.js-item-like').filter('[href="' + item.attr('href') + '"]').removeClass('grid-item-like--active');
        } else {
            $('.js-item-like').filter('[href="' + item.attr('href') + '"]').addClass('grid-item-like--active');
        }

        $.ajax({
                url: this.href,
                type: method,
                dataType: 'json',
            })
            .done(function(data) {
                if (data.isLogin) {
                    // if (method === 'DELETE') {
                    //     item.parents('.grid-item').remove();
                    // }
                } else {
                    if (typeof localStorage === 'undefined') {
                        return;
                    }

                    var likes = (localStorage.likes) ? JSON.parse(localStorage.likes) : [];

                    if (method === 'POST') {
                        likes.push(data.id);
                    } else {
                        var indexLike = likes.indexOf(data.id);
                        if (indexLike > -1) {
                            likes.splice(indexLike, 1);
                        }
                    }

                    if (likes.length > 0) {
                        displayNoticesMesssage();
                    } else {
                        removeNotices();
                    }

                    localStorage.likes = JSON.stringify(likes);
                }
            })
            .fail(function() {
                console.log("error");
            });
    });

    function displayNoticesMesssage() {
        if ($('.notice-like').length > 0) {
            return;
        }

        var block = $('<div>', {
            'class': 'notice-like',
            'html': '<a href="/register">Sign Up</a> to persist your likes stored locally!'
        });

        block.appendTo(document.body);
    }

    function removeNotices() {
        $('.notice-like').remove();
    }

    // apply likes
    (function() {
        if (typeof localStorage === 'undefined') {
            return;
        }

        var likes = (localStorage.likes) ? JSON.parse(localStorage.likes) : [];

        if (likes.length < 1) {
            return;
        }

        if (document.body.classList.contains('logged-in')) {
            $.ajax({
                    url: '/likes',
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        items: likes
                    }
                })
                .done(function(data) {
                    delete localStorage.likes;
                })
                .fail(function() {
                    console.log("error");
                });
        } else {
            displayNoticesMesssage();

            $.each(likes, function(index, like) {
                $('.js-item-like').filter('[href="/items/' + like + '/likes"]').addClass('grid-item-like--active');
            });
        }
    })();
})(jQuery, window, document);

// poup shots
(function(window, document, undefined) {
    'use strict';

    Object.create({
        popup: $('.popup'),
        grid: $('.grid'),
        initialURL: location.href,
        openShotIndex: -1,
        historyState: true,

        init: function() {
            var t = this;

            if (!t.grid.length) {
                // in case the history have been changed before force to go to that change
                window.addEventListener('popstate', function(e) {
                    if (e.state && e.state.url) {
                        location.href = e.state.url;
                    }
                });

                return;
            }

            t.shots = t.grid.find('.grid-item').not('.grid-light');

            t.popupImage = t.popup.find('.popup-image');
            t.image = t.popup.find('.popup-image').find('img');
            t.title = t.popup.find('.popup-title');
            t.patterns = t.popup.find('.popup-patterns');
            t.like = t.popup.find('.popup-like');
            t.preview = t.popup.find('.popup-live-preview');
            t.date = t.popup.find('.popup-date');

            t.next = t.popup.find('.popup-next');
            t.prev = t.popup.find('.popup-prev');

            t.popup.on('click', function(e) {
                var event = e.target.getAttribute('data-event');

                if (event) {
                    t[event]();
                }
            });

            $('.grid-item-link').on('click', function(e) {
                e.preventDefault();

                var item = $(this).parent();

                t.populatePopup(item);
                t.openPopup();

                t.isLastShot(t.openShotIndex);
                t.isFirstShot(t.openShotIndex);
            });

            window.addEventListener('popstate', function(e) {
                var url = e.state.url;

                if (url === t.initialURL) {
                    t.disableHistoryState();
                    t.closePopup();
                    t.enableHistoryState();
                } else {
                    var id = url.replace(/(.*?)\/items\//, '');

                    if (id) {
                        t.disableHistoryState();
                        $('.grid-item-link').filter('[href="/items/' + id + '"]').click();
                        t.enableHistoryState();
                    }
                }
            });

            // push initial state
            history.replaceState({ url: t.initialURL }, '', null);
        },

        populatePopup: function(item) {
            var t = this;
            var url = item.find('.grid-item-link').attr('href');
            var id = url.replace('/items/', '');

            if (t.historyState) {
                history.pushState({ url: url }, '', url);
            }

            // store open shot
            t.openShotIndex = $.inArray(item[0], t.shots);

            var preview = item.find('.grid-item-open')[0].href;

            t.popupImage[0].href = preview;
            t.image[0].src = item.find('.grid-item-link').find('img')[0].src;
            t.title[0].innerHTML = item.find('.grid-item-link-caption-title')[0].innerHTML;
            t.patterns[0].innerHTML = item.find('.grid-item-link-caption-tag')[0].innerHTML;
            t.like[0].href = '/items/' + id + '/likes';

            if (item.find('.grid-item-like--active').length) {
                t.like.addClass('grid-item-like--active');
            } else {
                t.like.removeClass('grid-item-like--active');
            }

            t.preview.find('a').attr('href', preview);
            t.date[0].innerHTML = item.find('.grid-item-date')[0].innerHTML;

            // sends a pageview hit to Google Analytics
            if (typeof ga !== 'undefined') {
                ga('send', 'pageview', location.pathname);
            }
        },

        closePopup: function() {
            var t = this;

            t.popup.hide();

            t.popup.removeClass('popup-last popup-first');

            $('html').css({
                overflow: '',
                paddingRight: ''
            });

            $(document).off('keydown.cbp');

            // reset open shot index
            t.openShotIndex = -1;

            if (t.historyState) {
                history.pushState({ url: t.initialURL }, '', t.initialURL);
            }
        },

        openPopup: function() {
            var t = this;

            t.popup.show();

            $('html').css({
                overflow: 'hidden',
                paddingRight: window.innerWidth - $(document).width()
            });

            $(document).on('keydown.cbp', function(e) {
                if (e.keyCode === 37) { // prev key
                    t.prevShot();
                } else if (e.keyCode === 39) { // next key
                    t.nextShot();
                } else if (e.keyCode === 27) { //esc key
                    t.closePopup();
                }
            });
        },

        nextShot: function() {
            var t = this;
            var indexNextShot = t.openShotIndex + 1;

            if (t.openShotIndex === 0) {
                t.popup.removeClass('popup-first');
            }

            if (t.isLastShot(indexNextShot)) {
                t.populatePopup(t.shots.eq(indexNextShot));
            }
        },

        prevShot: function() {
            var t = this;
            var indexPrevShot = t.openShotIndex - 1;

            if (t.openShotIndex === t.shots.length - 1) {
                t.popup.removeClass('popup-last');
            }

            if (t.isFirstShot(indexPrevShot)) {
                t.populatePopup(t.shots.eq(indexPrevShot));
            }
        },

        isLastShot: function(indexShot) {
            var t = this;
            var len = t.shots.length - 1;

            if (indexShot === len) {
                t.popup.addClass('popup-last');
            } else if (indexShot > len) {
                return false;
            }

            return true;
        },

        isFirstShot: function(indexShot) {
            var t = this;

            if (indexShot === 0) {
                t.popup.addClass('popup-first');
            } else if (indexShot < 0) {
                return false;
            }

            return true;
        },

        disableHistoryState: function() {
            this.historyState = false;
        },

        enableHistoryState: function() {
            this.historyState = true;
        }
    }).init();
})(window, document);
